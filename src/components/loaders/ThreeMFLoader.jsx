import React, { useCallback, useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import lib3mf from "@3mfconsortium/lib3mf";

import { ThreeMFLoaderContext } from "./ThreeMFLoaderContext.js";

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

const matrixFromTransform43 = (matrix43) => {
  if (!Array.isArray(matrix43) || matrix43.length !== 4) return null;
  const m = new THREE.Matrix4();
  m.set(
    matrix43[0][0],
    matrix43[0][1],
    matrix43[0][2],
    matrix43[3][0],
    matrix43[1][0],
    matrix43[1][1],
    matrix43[1][2],
    matrix43[3][1],
    matrix43[2][0],
    matrix43[2][1],
    matrix43[2][2],
    matrix43[3][2],
    0,
    0,
    0,
    1
  );
  return m;
};

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
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      pendingLoadsRef.current.clear();
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
      } catch (err) {
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
        const baseColor =
          resource.baseColor && typeof resource.baseColor === "object"
            ? resource.baseColor
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

      const buildSliceGroup = (sliceStacks = [], fallbackBounds = null) => {
        if (!Array.isArray(sliceStacks) || !sliceStacks.length) return null;
        const root = new THREE.Group();
        root.name = "Slice Stacks";

        sliceStacks.forEach((stack, stackIndex) => {
          const stackGroup = new THREE.Group();
          const stackId = stack?.resourceId ?? stackIndex + 1;
          stackGroup.name = `Slice Stack ${stackId}`;

          const slices = Array.isArray(stack?.slices) ? stack.slices : [];
          if (!slices.length) {
            root.add(stackGroup);
            return;
          }

          const addLoop = (points, z) => {
            if (points.length < 2) return null;
            const positions = new Float32Array(points.length * 2 * 3);
            let offset = 0;
            for (let i = 0; i < points.length; i += 1) {
              const a = points[i];
              const b = points[(i + 1) % points.length];
              positions[offset++] = a.x;
              positions[offset++] = a.y;
              positions[offset++] = z;
              positions[offset++] = b.x;
              positions[offset++] = b.y;
              positions[offset++] = z;
            }
            return positions;
          };

          const fallbackVertices = (() => {
            if (!fallbackBounds) return [];
            const min = fallbackBounds.min;
            const max = fallbackBounds.max;
            if (!min || !max) return [];
            return [
              { x: min.x, y: min.y },
              { x: max.x, y: min.y },
              { x: max.x, y: max.y },
              { x: min.x, y: max.y },
            ];
          })();

          const material = new THREE.LineBasicMaterial({
            color: 0x0f172a,
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
            depthTest: false,
          });

          slices.forEach((slice) => {
            const vertices = Array.isArray(slice?.vertices) ? slice.vertices : [];
            const verticesOrFallback = vertices.length >= 2 ? vertices : fallbackVertices;
            if (verticesOrFallback.length < 2) return;
            const z = Number.isFinite(Number(slice?.zTop)) ? Number(slice.zTop) : 0;
            const polygonIndexCounts = Array.isArray(slice?.polygonIndexCounts)
              ? slice.polygonIndexCounts
              : [];

            let positions = null;
            if (polygonIndexCounts.length) {
              const countValue = polygonIndexCounts[0];
              const count = Number.isFinite(Number(countValue)) ? Number(countValue) : 0;
              if (count >= 2) {
                const maxCount = count === verticesOrFallback.length + 1 ? verticesOrFallback.length : count;
                positions = addLoop(
                  verticesOrFallback.slice(0, Math.min(verticesOrFallback.length, maxCount)),
                  z
                );
              }
            } else {
              positions = addLoop(verticesOrFallback, z);
            }

            if (!positions) return;

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
            const lines = new THREE.LineSegments(geometry, material);
            lines.userData.isSliceLine = true;
            lines.userData.sliceIndex = slice.index ?? null;
            lines.renderOrder = 2;
            lines.visible = true;
            stackGroup.add(lines);
          });

          root.add(stackGroup);
        });

        return root.children.length ? root : null;
      };


      // --- Consuming Flat Geometry from Worker ---
      if (parsed.geometry) {
        const { positions, colors, uvs, resourceIds, groups, vertexCount, beamLines } = parsed.geometry;

        if (vertexCount > 0) {
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
          geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
          geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));

          // Virtual mesh attributes for per-resource visibility toggling
          if (resourceIds) {
            geometry.setAttribute("virtualResourceId", new THREE.BufferAttribute(resourceIds, 1));
            // Initialize visibility to 1 (visible) for all vertices
            const visibility = new Float32Array(vertexCount);
            visibility.fill(1.0);
            geometry.setAttribute("virtualVisibility", new THREE.BufferAttribute(visibility, 1));
            // Track which vertices use textures (for visibility shader logic)
            const useTexture = new Float32Array(vertexCount);
            const hasTexture = new Float32Array(vertexCount);
            // Will be populated based on groups
            geometry.setAttribute("virtualUseTexture", new THREE.BufferAttribute(useTexture, 1));
            geometry.setAttribute("virtualHasTexture", new THREE.BufferAttribute(hasTexture, 1));
          }

          // Materials
          // We need to map textureId -> material index per group.
          // groups: { start, count, textureId }.

          const matCache = new Map(); // textureId (or null) -> material

          const getMaterial = (textureId) => {
            const key = textureId ?? "none";
            if (matCache.has(key)) return matCache.get(key);

            const tex = textureId ? textureMap.get(textureId) : null;
            const hasTex = !!tex;

            const material = new THREE.MeshPhongMaterial({
              color: hasTex ? "#ffffff" : "#ffffff",
              map: tex || null,
              vertexColors: !hasTex, // Use vertex colors if no texture
              specular: "#111111",
              shininess: 10,
              flatShading: true
            });

            matCache.set(key, material);
            return material;
          };

          const distinctMaterials = [];
          const materialIndexMap = new Map(); // key -> index in distinctMaterials array

          groups.forEach(g => {
            const key = g.textureId ?? "none";
            if (!materialIndexMap.has(key)) {
              const mat = getMaterial(g.textureId);
              materialIndexMap.set(key, distinctMaterials.length);
              distinctMaterials.push(mat);
            }
            const matIndex = materialIndexMap.get(key);
            geometry.addGroup(g.start, g.count, matIndex);
          });

          // If no groups (weird?), add one default
          if (groups.length === 0) {
            const mat = getMaterial(null);
            distinctMaterials.push(mat);
            geometry.addGroup(0, vertexCount, 0);
          }

          const mesh = new THREE.Mesh(geometry, distinctMaterials);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.name = fileName?.replace(/\\.[^/.]+$/, "") || "3MF Model";
          // Mark as virtual mesh for per-resource visibility toggling
          if (resourceIds) {
            mesh.userData.virtualMesh = true;
          }
          // Orient for Y-up if needed (3MF is typically Z-up, but ThreeMFLoader usually rotates it?)
          // Standard ThreeMFLoader in three.js:
          // "3MF documents use a right-handed coordinate system... Z-axis is positive up."
          // THREE is Y-up.
          // The previous code didn't seem to apply a global rotation, assuming the viewer camera handles it OR usage of a container.
          // I will check if I need to rotate it.
          // The previous code put it in a group.

          group.add(mesh);
        }

        if (beamLines?.positions?.length) {
          const lineCount = beamLines.positions.length / 6;
          const vertCount = lineCount * 4;
          const idxCount = lineCount * 6;
          const startAttr = new Float32Array(vertCount * 3);
          const endAttr = new Float32Array(vertCount * 3);
          const sideAttr = new Float32Array(vertCount);
          const alongAttr = new Float32Array(vertCount);
          const resourceAttr = new Float32Array(vertCount);
          const radiusAttr = new Float32Array(vertCount);
          const indices = new Uint32Array(idxCount);

          let v = 0;
          let i = 0;
          for (let line = 0; line < lineCount; line += 1) {
            const srcOff = line * 6;
            const sx = beamLines.positions[srcOff + 0];
            const sy = beamLines.positions[srcOff + 1];
            const sz = beamLines.positions[srcOff + 2];
            const ex = beamLines.positions[srcOff + 3];
            const ey = beamLines.positions[srcOff + 4];
            const ez = beamLines.positions[srcOff + 5];
            const resId = beamLines.resourceIds ? beamLines.resourceIds[line * 2] : 0;
            const radius = beamLines.radii ? beamLines.radii[line] : 1;

            const writeVertex = (along, side) => {
              const base = v * 3;
              startAttr[base + 0] = sx;
              startAttr[base + 1] = sy;
              startAttr[base + 2] = sz;
              endAttr[base + 0] = ex;
              endAttr[base + 1] = ey;
              endAttr[base + 2] = ez;
              sideAttr[v] = side;
              alongAttr[v] = along;
              resourceAttr[v] = resId;
              radiusAttr[v] = radius;
              v += 1;
            };

            writeVertex(0, -1);
            writeVertex(0, 1);
            writeVertex(1, -1);
            writeVertex(1, 1);

            const baseIndex = line * 4;
            indices[i++] = baseIndex + 0;
            indices[i++] = baseIndex + 2;
            indices[i++] = baseIndex + 1;
            indices[i++] = baseIndex + 2;
            indices[i++] = baseIndex + 3;
            indices[i++] = baseIndex + 1;
          }

          const lineGeom = new THREE.BufferGeometry();
          lineGeom.setAttribute("position", new THREE.BufferAttribute(startAttr, 3));
          lineGeom.setAttribute("aStart", new THREE.BufferAttribute(startAttr, 3));
          lineGeom.setAttribute("aEnd", new THREE.BufferAttribute(endAttr, 3));
          lineGeom.setAttribute("aSide", new THREE.BufferAttribute(sideAttr, 1));
          lineGeom.setAttribute("aAlong", new THREE.BufferAttribute(alongAttr, 1));
          lineGeom.setAttribute("virtualResourceId", new THREE.BufferAttribute(resourceAttr, 1));
          lineGeom.setAttribute("aRadius", new THREE.BufferAttribute(radiusAttr, 1));
          lineGeom.setIndex(new THREE.BufferAttribute(indices, 1));

          const lineMat = new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            uniforms: {
              uResolution: { value: new THREE.Vector2(1, 1) },
              uLineWidth: { value: 1.5 },
              uColor: { value: new THREE.Color(0x0f172a) },
              uOpacity: { value: 0.5 },
            },
            vertexShader: `
              uniform vec2 uResolution;
              uniform float uLineWidth;
              attribute vec3 aStart;
              attribute vec3 aEnd;
              attribute float aSide;
              attribute float aAlong;
              attribute float aRadius;

              void main() {
                vec4 start = modelViewMatrix * vec4(aStart, 1.0);
                vec4 end = modelViewMatrix * vec4(aEnd, 1.0);
                vec4 startClip = projectionMatrix * start;
                vec4 endClip = projectionMatrix * end;

                vec2 startNdc = startClip.xy / startClip.w;
                vec2 endNdc = endClip.xy / endClip.w;
                vec2 delta = endNdc - startNdc;
                float len = length(delta);
                vec2 dir = normalize(delta);
                if (len < 0.0001) {
                  dir = vec2(1.0, 0.0);
                }
                vec2 normal = vec2(-dir.y, dir.x);
                float width = uLineWidth;
                float taper = smoothstep(0.08, 0.2, aAlong) * smoothstep(0.08, 0.2, 1.0 - aAlong);
                vec2 offset = normal * (width / uResolution) * 2.0 * taper;

                vec4 clip = mix(startClip, endClip, aAlong);
                clip.xy += offset * aSide * clip.w;
                gl_Position = clip;
              }
            `,
            fragmentShader: `
              uniform vec3 uColor;
              uniform float uOpacity;
              void main() {
                gl_FragColor = vec4(uColor, uOpacity);
              }
            `,
          });

          const lines = new THREE.Mesh(lineGeom, lineMat);
          lines.userData.isBeamLatticeLines = true;
          lines.frustumCulled = false;
          lines.userData.isBeamLatticeLines = true;
          lines.renderOrder = 2;
          lines.onBeforeRender = (renderer) => {
            const size = renderer.getSize(new THREE.Vector2());
            lineMat.uniforms.uResolution.value.set(size.x, size.y);
          };
          group.add(lines);
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
      const sliceGroup = buildSliceGroup(parsed.sliceStacks, fallbackBounds);
      if (sliceGroup) {
        group.add(sliceGroup);
      }

      // Center the model
      const boundingBox = new THREE.Box3().setFromObject(group);
      if (!boundingBox.isEmpty()) {
        const center = boundingBox.getCenter(new THREE.Vector3());
        group.children.forEach((child) => {
          child.position.sub(center);
          child.updateMatrixWorld(true);
        });
        group.updateMatrixWorld(true);
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
        sliceStacks: parsed.sliceStacks,
        items: parsed.items
      };

      return resultPayload;
    },
    [ensureWorker]
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
