import React, { useCallback, useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import lib3mf from "@3mfconsortium/lib3mf";

import { ThreeMFLoaderContext } from "./ThreeMFLoaderContext.js";
import { createBeamLatticeGroup } from "../../lib/beamLatticeGeometry.js";

const DEFAULT_PALETTE = [
  "#38bdf8",
  "#f97316",
  "#a855f7",
  "#22c55e",
  "#facc15",
  "#ef4444",
  "#14b8a6",
  "#8b5cf6",
];

export function ThreeMFLoaderProvider({ children }) {
  const lib3mfRef = useRef(null);
  const workerRef = useRef(null);
  const pendingLoadsRef = useRef(new Map());

  const ensureLib3mf = useCallback(async () => {
    if (!lib3mfRef.current) {
      lib3mfRef.current = lib3mf();
    }
    return lib3mfRef.current;
  }, []);

  const ensureWorker = useCallback(() => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("../../workers/lib3mfWorker.js", import.meta.url),
        { type: "module" }
      );
      workerRef.current.onmessage = (event) => {
        const { id, ok, parsed, error, timing } = event.data || {};
        const pending = pendingLoadsRef.current.get(id);
        if (!pending) return;
        pendingLoadsRef.current.delete(id);
        clearTimeout(pending.timeoutId);
        if (timing) {
          console.info(
            "[lib3mf worker] timings(ms)",
            {
              libInit: Math.round(timing.libInitMs),
              parse: Math.round(timing.parseMs),
              total: Math.round(timing.totalMs),
            }
          );
        }
        if (ok) pending.resolve(parsed);
        else pending.reject(new Error(error || "Worker failed."));
      };
      workerRef.current.onerror = (event) => {
        pendingLoadsRef.current.forEach((pending) => {
          clearTimeout(pending.timeoutId);
          pending.reject(new Error(event?.message || "Worker crashed."));
        });
        pendingLoadsRef.current.clear();
      };
    }
    return workerRef.current;
  }, []);

  useEffect(() => {
    const pending = pendingLoadsRef.current;
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      pending.forEach((load) => {
        clearTimeout(load.timeoutId);
        load.reject(new Error("3MF loader was disposed."));
      });
      pending.clear();
    };
  }, []);

  const load3mf = useCallback(
    async (arrayBuffer, fileName = "model.3mf", options = {}) => {
      const buildStart = performance.now();
      console.info("[lib3mf] load3mf:start", { fileName, bytes: arrayBuffer?.byteLength });
      const reportStage = (stage, detail = null) => {
        if (typeof options?.onStage === "function") {
          options.onStage({ stage, detail });
        }
      };
      const specificationUrls = options?.specificationUrls ??
        (options?.specificationUrl ? [options.specificationUrl] : undefined);

      let parsed = null;
      const worker = ensureWorker();
      const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      try {
        reportStage("parsing-3mf", "Parsing 3MF with lib3mf");
        parsed = await new Promise((resolve, reject) => {
          const timeoutId = window.setTimeout(() => {
            pendingLoadsRef.current.delete(id);
            reject(new Error("Worker timed out."));
          }, 30000);
          pendingLoadsRef.current.set(id, { resolve, reject, timeoutId });

          const workerBuffer = arrayBuffer.slice(0);
          worker.postMessage(
            {
              id,
              arrayBuffer: workerBuffer,
              fileName,
              options: { specificationUrls },
            },
            [workerBuffer]
          );
        });
      } catch {
        try {
          workerRef.current?.terminate?.();
        } finally {
          workerRef.current = null;
        }
        parsed = await (async () => {
          const lib = await ensureLib3mf();
          const { loadThreeMFModel } = await import("../../lib/lib3mfEngine.js");
          console.info("[lib3mf] worker failed, parsing on main thread");
          reportStage("parsing-3mf", "Parsing 3MF on main thread");
          return loadThreeMFModel(lib, arrayBuffer, fileName, {
            specificationUrls,
          });
        })();
      }
      reportStage("building-textures", "Preparing textures");
      console.info("[lib3mf] parsed", {
        ms: Math.round(performance.now() - buildStart),
        meshes: parsed?.meshResources?.length ?? 0,
        components: parsed?.componentResources?.length ?? 0,
        textures: parsed?.texture2Ds?.length ?? 0,
      });

      const palette = Array.isArray(options?.palette) && options.palette.length
        ? options.palette
        : DEFAULT_PALETTE;
      let paletteIndex = 0;

      const group = new THREE.Group();
      group.name = fileName?.replace(/\.[^/.]+$/, "") || "3MF Model";

      const meshResources = new Map();
      const componentResources = new Map();

      const resolveTextureMime = (contentType, attachmentPath) => {
        if (contentType && typeof contentType === "string") return contentType;
        if (attachmentPath && typeof attachmentPath === "string") {
          const lower = attachmentPath.toLowerCase();
          if (lower.endsWith(".png")) return "image/png";
          if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        }
        return "image/png";
      };

      const mapTileStyle = (styleValue) => {
        if (styleValue === "Mirror" || styleValue === 1) return THREE.MirroredRepeatWrapping;
        if (styleValue === "Clamp" || styleValue === 2) return THREE.ClampToEdgeWrapping;
        if (styleValue === "NoTileStyle" || styleValue === 3) return THREE.ClampToEdgeWrapping;
        return THREE.RepeatWrapping;
      };

      const mapTextureFilter = (filterValue) => {
        if (filterValue === "Nearest" || filterValue === 2) {
          return {
            magFilter: THREE.NearestFilter,
            minFilter: THREE.NearestMipmapNearestFilter,
          };
        }
        return {
          magFilter: THREE.LinearFilter,
          minFilter: THREE.LinearMipmapLinearFilter,
        };
      };

      const buildTextureMap = async () => {
        const textures = new Map();
        if (!Array.isArray(parsed.texture2Ds) || !parsed.texture2Ds.length) return textures;
        const loader = new THREE.TextureLoader();
        const entries = parsed.texture2Ds.map(async (entry) => {
          if (!entry?.buffer) return;
          const buffer = ArrayBuffer.isView(entry.buffer)
            ? entry.buffer
            : Array.isArray(entry.buffer)
              ? Uint8Array.from(entry.buffer)
              : null;
          if (!buffer) return;
          const mime = resolveTextureMime(entry.contentType, entry.attachmentPath);
          const blob = new Blob([buffer], { type: mime });
          const url = URL.createObjectURL(blob);
          try {
            const texture = await loader.loadAsync(url);
            texture.flipY = false;
            texture.wrapS = mapTileStyle(entry.tileStyleU);
            texture.wrapT = mapTileStyle(entry.tileStyleV);
            const filters = mapTextureFilter(entry.filter);
            texture.magFilter = filters.magFilter;
            texture.minFilter = filters.minFilter;
            texture.needsUpdate = true;
            textures.set(entry.textureId, texture);
          } finally {
            URL.revokeObjectURL(url);
          }
        });
        await Promise.all(entries);
        return textures;
      };

      const textureMap = await buildTextureMap();
      console.info("[lib3mf] textures ready", {
        ms: Math.round(performance.now() - buildStart),
        textures: textureMap.size,
      });
      reportStage("building-resources", "Building mesh resources");
      const textureGroupMap = new Map();
      if (Array.isArray(parsed.texture2DGroups)) {
        parsed.texture2DGroups.forEach((group) => {
          if (!group) return;
          const coordsById = new Map();
          (group.coords || []).forEach((coord) => {
            if (coord?.propertyId == null) return;
            coordsById.set(String(coord.propertyId), coord);
          });
          textureGroupMap.set(group.groupId, {
            ...group,
            coordsById,
          });
        });
      }

      const textureResolvers = new Map();
      const buildTextureResolver = (group) => {
        const coords = Array.isArray(group.coords) ? group.coords : [];
        const coordsById = group.coordsById || new Map();
        const propertyIds = Array.isArray(group.propertyIds) ? group.propertyIds : [];
        let idArray = null;
        if (propertyIds.length) {
          let maxId = -1;
          let allFinite = true;
          propertyIds.forEach((id) => {
            const n = Number(id);
            if (!Number.isFinite(n) || n < 0) {
              allFinite = false;
            } else {
              maxId = Math.max(maxId, n);
            }
          });
          if (allFinite && maxId <= 1000000) {
            idArray = new Array(maxId + 1);
            propertyIds.forEach((id, index) => {
              const n = Number(id);
              if (!Number.isFinite(n)) return;
              idArray[n] = coords[index] || coordsById.get(String(id)) || null;
            });
          }
        }
        const resolve = (pid) => {
          if (pid == null) return null;
          const n = Number(pid);
          if (idArray && Number.isFinite(n)) {
            const coord = idArray[n];
            if (coord) return coord;
          }
          if (coordsById.size) {
            const direct = coordsById.get(String(pid));
            if (direct) return direct;
            if (Number.isFinite(n)) {
              const resolvedId = coerceTexturePid(group, pid);
              const coerced = coordsById.get(String(resolvedId));
              if (coerced) return coerced;
            }
          }
          if (Number.isFinite(n)) {
            return coords[n] || coords[n - 1] || null;
          }
          return null;
        };
        return { resolve, textureId: group.textureId };
      };

      textureGroupMap.forEach((group, groupId) => {
        textureResolvers.set(groupId, buildTextureResolver(group));
      });

      const coerceTexturePid = (group, pid) => {
        if (!group || pid == null) return pid;
        const ids = Array.isArray(group.propertyIds) ? group.propertyIds : [];
        if (ids.length && ids.includes(pid)) return pid;
        const n = Number(pid);
        if (Number.isFinite(n)) {
          if (n >= 0 && n < ids.length) return ids[n];
          if (n >= 1 && n <= ids.length) return ids[n - 1];
        }
        return pid;
      };

      parsed.meshResources.forEach((resource) => {
        const fallbackColor = palette[paletteIndex % palette.length];
        paletteIndex += 1;

        const fallback = new THREE.Color(fallbackColor);
        const hasResolvedPerTriangleColor =
          Number(resource?.materialColorStats?.trianglesWithColor ?? 0) > 0;
        const resourceBaseColor = resource.baseColor && typeof resource.baseColor === "object"
          ? resource.baseColor
          : null;
        const baseColor =
          hasResolvedPerTriangleColor && resourceBaseColor
            ? resourceBaseColor
            : { r: fallback.r, g: fallback.g, b: fallback.b, a: 1 };

        const baseName = resource.displayName || `Mesh ${resource.resourceId ?? meshResources.size + 1}`;

        meshResources.set(resource.resourceId, {
          ...resource,
          displayName: baseName,
          baseColor,
        });
      });

      console.info("[lib3mf] mesh resources built", {
        ms: Math.round(performance.now() - buildStart),
        meshResources: meshResources.size,
      });

      reportStage("building-components", "Building component resources");
      parsed.componentResources.forEach((component) => {
        componentResources.set(component.resourceId, component);
      });

      // --- Consuming Flat Geometry from Worker ---
      if (parsed.geometry) {
        const {
          positions,
          colors,
          uvs,
          resourceIds,
          instanceIds,
          instances = [],
          groups,
          vertexCount,
          beamLines,
        } = parsed.geometry;

        if (vertexCount > 0) {
          const matCache = new Map(); // textureId/mode -> material

          const getMaterial = (textureId, options = {}) => {
            const vertexColorsEnabled = !!options.vertexColors;
            const solidColor = options.color || "#ffffff";
            const beamShell = !!options.beamShell;
            const key = `${textureId ?? "none"}::${vertexColorsEnabled ? "vc" : `solid:${solidColor}`}::${beamShell ? "beam-shell" : "surface"}`;
            if (matCache.has(key)) return matCache.get(key);

            const tex = textureId ? textureMap.get(textureId) : null;
            const hasTex = !!tex;

            const material = new THREE.MeshPhongMaterial({
              color: hasTex ? "#ffffff" : solidColor,
              map: tex || null,
              vertexColors: hasTex ? false : vertexColorsEnabled,
              specular: "#111111",
              shininess: 10,
              flatShading: true,
              transparent: beamShell,
              opacity: beamShell ? 0.16 : 1,
              depthWrite: !beamShell,
              side: beamShell ? THREE.DoubleSide : THREE.FrontSide,
            });

            matCache.set(key, material);
            return material;
          };

          if (resourceIds?.length) {
            const instanceMap = new Map(
              instances.map((instance) => [Number(instance.instanceId), instance])
            );
            const sourceGroups = groups.length
              ? groups
              : [{ start: 0, count: vertexCount, textureId: null }];
            const buckets = new Map();

            const ensureBucket = (resourceId, instanceId, textureId) => {
              const key = `${instanceId ?? "none"}::${resourceId ?? "none"}::${textureId ?? "none"}`;
              if (!buckets.has(key)) {
                buckets.set(key, {
                  resourceId,
                  instanceId,
                  textureId,
                  positions: [],
                  colors: [],
                  uvs: [],
                });
              }
              return buckets.get(key);
            };

            sourceGroups.forEach((entry) => {
              const start = Math.max(0, Number(entry.start) || 0);
              const count = Math.max(0, Number(entry.count) || 0);
              const end = Math.min(vertexCount, start + count);

              for (let vertex = start; vertex + 2 < end; vertex += 3) {
                const resourceId = Number(resourceIds[vertex]);
                const instanceId = instanceIds?.length ? Number(instanceIds[vertex]) : null;
                const bucket = ensureBucket(resourceId, instanceId, entry.textureId ?? null);

                for (let local = 0; local < 3; local += 1) {
                  const index = vertex + local;
                  const posBase = index * 3;
                  const uvBase = index * 2;
                  bucket.positions.push(
                    positions[posBase + 0],
                    positions[posBase + 1],
                    positions[posBase + 2]
                  );
                  bucket.colors.push(
                    colors[posBase + 0],
                    colors[posBase + 1],
                    colors[posBase + 2]
                  );
                  bucket.uvs.push(uvs[uvBase + 0], uvs[uvBase + 1]);
                }
              }
            });

            buckets.forEach((bucket) => {
              if (!bucket.positions.length) return;
              const geometry = new THREE.BufferGeometry();
              geometry.setAttribute(
                "position",
                new THREE.BufferAttribute(new Float32Array(bucket.positions), 3)
              );
              geometry.setAttribute(
                "color",
                new THREE.BufferAttribute(new Float32Array(bucket.colors), 3)
              );
              geometry.setAttribute(
                "uv",
                new THREE.BufferAttribute(new Float32Array(bucket.uvs), 2)
              );

              const resource = meshResources.get(bucket.resourceId);
              const instance = instanceMap.get(bucket.instanceId);
              const hasResolvedPerTriangleColor =
                Number(resource?.materialColorStats?.trianglesWithColor ?? 0) > 0;
              const solidColor = resource?.baseColor
                ? new THREE.Color(
                    resource.baseColor.r ?? 1,
                    resource.baseColor.g ?? 1,
                    resource.baseColor.b ?? 1
                  ).getStyle()
                : "#ffffff";

              if (!bucket.textureId && !hasResolvedPerTriangleColor) {
                const fallbackColor = new THREE.Color(solidColor);
                const colorAttr = geometry.getAttribute("color");
                for (let i = 0; i < colorAttr.count; i += 1) {
                  colorAttr.setXYZ(i, fallbackColor.r, fallbackColor.g, fallbackColor.b);
                }
                colorAttr.needsUpdate = true;
              }

              const mesh = new THREE.Mesh(
                geometry,
                getMaterial(bucket.textureId, {
                  vertexColors: !bucket.textureId && hasResolvedPerTriangleColor,
                  color: solidColor,
                  beamShell: resource?.isBeamLattice === true,
                })
              );
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              mesh.name =
                resource?.displayName ||
                `Mesh ${bucket.resourceId ?? group.children.length + 1}`;
              mesh.userData.resourceId = bucket.resourceId;
              mesh.userData.instanceId = bucket.instanceId;
              mesh.userData.visibilityId = instance?.visibilityId ?? null;
              mesh.userData.instanceKey = instance?.instanceKey ?? null;
              mesh.userData.buildItemIndex = instance?.buildItemIndex ?? null;
              mesh.userData.componentPath = instance?.componentPath ?? [];
              mesh.userData.bounds = instance?.bounds ?? null;
              mesh.userData.uniqueResourceId = resource?.uniqueResourceId ?? null;
              mesh.userData.uuid = resource?.uuid ?? null;
              mesh.userData.hasUUID = resource?.hasUUID ?? false;
              mesh.userData.vertexCount = resource?.vertexCount ?? bucket.positions.length / 3;
              mesh.userData.triangleCount = resource?.triangleCount ?? bucket.positions.length / 9;
              mesh.userData.materialColorStats = resource?.materialColorStats ?? null;
              mesh.userData.objectLevelProperty = resource?.objectLevelProperty ?? null;
              mesh.userData.meshDiagnostics = resource?.meshSummary ?? null;
              group.add(mesh);
            });
          } else {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
            geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

            const distinctMaterials = [];
            const materialIndexMap = new Map(); // key -> index in distinctMaterials array

            groups.forEach((entry) => {
              const key = entry.textureId ?? "none";
              if (!materialIndexMap.has(key)) {
                const mat = getMaterial(entry.textureId);
                materialIndexMap.set(key, distinctMaterials.length);
                distinctMaterials.push(mat);
              }
              const matIndex = materialIndexMap.get(key);
              geometry.addGroup(entry.start, entry.count, matIndex);
            });

            if (groups.length === 0) {
              distinctMaterials.push(getMaterial(null));
              geometry.addGroup(0, vertexCount, 0);
            }

            const mesh = new THREE.Mesh(geometry, distinctMaterials);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.name = fileName?.replace(/\\.[^/.]+$/, "") || "3MF Model";
            group.add(mesh);
          }
        }

        if (beamLines?.positions?.length) {
          group.add(createBeamLatticeGroup(beamLines, instances, beamLines.renderMode));
        }
      }

      if (!parsed.geometry || (parsed.geometry.vertexCount === 0 && !parsed.geometry.beamLines?.positions?.length)) {
        throw new Error("No geometry in 3MF file.");
      }

      const fallbackBounds = (() => {
        const mesh = group.children.find((child) => child.isMesh);
        if (!mesh?.geometry) return null;
        mesh.geometry.computeBoundingBox();
        return mesh.geometry.boundingBox || null;
      })();

      // Center the model
      const boundingBox = new THREE.Box3().setFromObject(group);
      let modelCenter = null;
      if (!boundingBox.isEmpty()) {
        const center = boundingBox.getCenter(new THREE.Vector3());
        modelCenter = center.clone();
        group.children.forEach((child) => {
          child.position.sub(center);
          child.updateMatrixWorld(true);
        });
        group.updateMatrixWorld(true);
      }

      if (Array.isArray(parsed.sliceStacks) && parsed.sliceStacks.length) {
        group.userData.slicePreviewSource = {
          sliceStacks: parsed.sliceStacks,
          fallbackBounds: fallbackBounds
            ? {
                min: {
                  x: fallbackBounds.min.x,
                  y: fallbackBounds.min.y,
                  z: fallbackBounds.min.z,
                },
                max: {
                  x: fallbackBounds.max.x,
                  y: fallbackBounds.max.y,
                  z: fallbackBounds.max.z,
                },
              }
            : null,
          center: modelCenter
            ? { x: modelCenter.x, y: modelCenter.y, z: modelCenter.z }
            : { x: 0, y: 0, z: 0 },
        };
      }

      console.info("[lib3mf] loaded", {
        ms: Math.round(performance.now() - buildStart),
        children: group.children.length,
      });

      const metadata = {
        fileName,
        unit: parsed.unit,
        lib3mfVersion: parsed.lib3mfVersion,
        specifications: parsed.specifications,
        primarySpecification: parsed.primarySpecification,
        counts: parsed.counts,
        modelUUID: parsed.modelUUID,
        baseMaterialGroups: parsed.baseMaterialGroups,
        colorGroups: parsed.colorGroups,
        texture2Ds: parsed.texture2Ds,
        texture2DGroups: parsed.texture2DGroups,
        sliceStacks: parsed.sliceStacks,
        diagnostics: parsed.diagnostics,
        items: parsed.items
      };

      const resultPayload = {
        group,
        meshes: group.children.filter(c => c.isMesh),
        metadata,
        diagnostics: parsed.diagnostics,
        report: {
          file: fileName,
          lib3mfVersion: parsed.lib3mfVersion,
          diagnostics: parsed.diagnostics,
          summary: metadata,
          items: parsed.items
        },
        meshCount: parsed.meshResources?.length ?? 0,
        meshResources: parsed.meshResources,
        componentResources: parsed.componentResources,
        instances: parsed.geometry?.instances ?? [],
        sliceStacks: parsed.sliceStacks,
        items: parsed.items
      };

      return resultPayload;
    },
    [ensureLib3mf, ensureWorker]
  );

  const contextValue = useMemo(
    () => ({
      ensureLib3mf,
      load3mf,
    }),
    [ensureLib3mf, load3mf]
  );

  return (
    <ThreeMFLoaderContext.Provider value={contextValue}>
      {children}
    </ThreeMFLoaderContext.Provider>
  );
}
