import React, { useCallback, useMemo, useRef, useEffect } from "react";
import * as THREE from "three";
import lib3mf from "@tensorgrad/lib3mf";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { ThreeMFLoaderContext } from "./ThreeMFLoaderContext.js";
import { normalizeName } from "../../lib/normalizeName.js";

const SPECIFICATION_URL = "https://github.com/3MFConsortium/lib3mf/blob/master/specification/specification.md";

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

const recordTransform = (object3d, label, matrix43) => {
  if (!object3d || !matrix43) return;
  if (!object3d.userData) object3d.userData = {};
  if (!Array.isArray(object3d.userData.transforms)) {
    object3d.userData.transforms = [];
  }
  object3d.userData.transforms.push({ label, matrix4x3: matrix43 });
};

const applyTransformToObject = (object3d, label, matrix43) => {
  if (!object3d || !matrix43) return;
  const matrix4 = matrixFromTransform43(matrix43);
  if (!matrix4) return;
  object3d.applyMatrix4(matrix4);
  object3d.updateMatrixWorld(true);
  recordTransform(object3d, label, matrix43);
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
          const { id, ok, parsed, error } = event.data || {};
          const pending = pendingLoadsRef.current.get(id);
          if (!pending) return;
          pendingLoadsRef.current.delete(id);
          clearTimeout(pending.timeoutId);
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
      const specificationUrls = options?.specificationUrls ??
        (options?.specificationUrl ? [options.specificationUrl] : undefined);

      let parsed = null;
      const worker = ensureWorker();
      const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
      try {
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
          return loadThreeMFModel(lib, arrayBuffer, fileName, {
            specificationUrls,
          });
        })();
      }

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
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(resource.positions, 3));
        geometry.setIndex(new THREE.BufferAttribute(resource.indices, 1));

        const triangleProps = Array.isArray(resource.triangleProperties)
          ? resource.triangleProperties
          : [];
        const hasTextureTriangles =
          triangleProps.some((entry) => textureGroupMap.has(entry?.resourceId ?? null)) ||
          (resource.objectLevelProperty?.ok &&
            textureGroupMap.has(resource.objectLevelProperty.resourceId));

        let processedGeometry = geometry;
        if (!hasTextureTriangles) {
          processedGeometry = mergeVertices(geometry, 1e-6);
        }
        processedGeometry.computeVertexNormals();
        processedGeometry.computeBoundingBox();
        processedGeometry.computeBoundingSphere();

        const fallbackColor = palette[paletteIndex % palette.length];
        paletteIndex += 1;

        const material = new THREE.MeshPhongMaterial({
          color: resource.usesVertexColors ? "#ffffff" : fallbackColor,
          shininess: 38,
          specular: "#9ca3af",
          vertexColors: !!resource.usesVertexColors,
        });

        let finalGeometry = processedGeometry;
        if (!hasTextureTriangles && resource.usesVertexColors && resource.vertexColors?.length) {
          finalGeometry = processedGeometry.toNonIndexed();
          finalGeometry.setAttribute(
            "color",
            new THREE.Float32BufferAttribute(resource.vertexColors, 3)
          );
          finalGeometry.attributes.color.needsUpdate = true;
          finalGeometry.computeVertexNormals();
          finalGeometry.computeBoundingBox();
          finalGeometry.computeBoundingSphere();
        }

        const baseName = resource.displayName || `Mesh ${resource.resourceId ?? meshResources.size + 1}`;

        meshResources.set(resource.resourceId, {
          resourceId: resource.resourceId,
          uniqueResourceId: resource.uniqueResourceId,
          displayName: baseName,
          name: resource.name,
          geometry: finalGeometry,
          material,
          baseColor: fallbackColor,
          vertexCount: resource.vertexCount,
          triangleCount: resource.triangleCount,
          meshSummary: resource.meshSummary,
          uuid: resource.uuid,
          hasUUID: resource.hasUUID,
          usesVertexColors: resource.usesVertexColors,
          materialColorStats: resource.materialColorStats,
          positions: resource.positions,
          indices: resource.indices,
          triangleProperties: resource.triangleProperties,
          objectLevelProperty: resource.objectLevelProperty,
          hasTextureTriangles,
        });

        // Release raw buffers once we've promoted them into THREE resources.
        if (!hasTextureTriangles) {
          resource.positions = undefined;
          resource.indices = undefined;
          resource.vertexColors = undefined;
        }
      });

      parsed.componentResources.forEach((component) => {
        componentResources.set(component.resourceId, component);
      });

      const meshes = [];
      let meshInstanceCount = 0;

      const registerMeshInstance = (mesh, resource, context) => {
        meshInstanceCount += 1;
        meshes.push({
          mesh,
          resourceId: resource.resourceId,
          uniqueResourceId: resource.uniqueResourceId,
          uuid: resource.uuid || null,
          vertexCount: resource.vertexCount,
          triangleCount: resource.triangleCount,
          color: resource.baseColor,
          source: {
            buildItemIndex: context.buildItemIndex ?? null,
            componentPath: context.componentPath || [],
            buildItemUuid: context.buildItemUuid ?? null,
            resourceUuid: resource.uuid || null,
          },
        });
      };

      const deriveInstanceName = (baseName, context) => {
        if (context.instanceName) return context.instanceName;
        if (Array.isArray(context.componentPath) && context.componentPath.length) {
          const pathLabel = context.componentPath
            .map((entry) => `${entry.resourceId ?? "?"}:${entry.componentIndex}`)
            .join(" → ");
          return `${baseName} (${pathLabel})`;
        }
        if (context.buildItemIndex !== undefined) {
          return `${baseName} (item ${context.buildItemIndex})`;
        }
        return baseName;
      };

      const instantiateResource = (resourceId, context = {}, visited = new Set()) => {
        if (resourceId === undefined || resourceId === null) return null;

        if (meshResources.has(resourceId)) {
          const resource = meshResources.get(resourceId);
          const displayName = normalizeName(
            { GetName: () => resource.name ?? null },
            resource.displayName
          );

          const buildMesh = (geometry, material, suffix, extraUserData) => {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            const name = suffix ? `${displayName} ${suffix}` : displayName;
            mesh.name = deriveInstanceName(name, context);
            mesh.userData = {
              vertexCount: resource.vertexCount,
              triangleCount: resource.triangleCount,
              resourceId: resource.resourceId,
              uniqueResourceId: resource.uniqueResourceId ?? null,
              baseColor: resource.baseColor,
              meshDiagnostics: resource.meshSummary,
              buildItemIndex: context.buildItemIndex,
              uuid: resource.uuid || resource.meshSummary?.uuid || null,
              hasUUID: resource.hasUUID ?? resource.meshSummary?.hasUUID ?? false,
              buildItemUuid: context.buildItemUuid ?? null,
              ...extraUserData,
            };
            if (Array.isArray(context.metadataEntries) && context.metadataEntries.length) {
              mesh.userData.metadataEntries = context.metadataEntries;
            }
            if (resource.materialColorStats) {
              mesh.userData.materialColorStats = resource.materialColorStats;
            }
            registerMeshInstance(mesh, resource, context);
            if (context.transform43) {
              applyTransformToObject(
                mesh,
                context.transformLabel || `Transform`,
                context.transform43
              );
            }
            return mesh;
          };

          if (!resource.hasTextureTriangles || !resource.triangleProperties?.length) {
            const material = resource.material.clone();
            if (resource.usesVertexColors) {
              material.vertexColors = true;
              material.color = new THREE.Color("#ffffff");
            } else {
              material.vertexColors = false;
              material.color = new THREE.Color(resource.baseColor);
            }
            return buildMesh(resource.geometry, material, "", null);
          }

          const positions = resource.positions;
          const indices = resource.indices;
          const triCount = resource.triangleCount ?? 0;
          const colorBuffer = resource.vertexColors;
          const objectLevel = resource.objectLevelProperty;

          const buckets = new Map();
          const defaultKey = "default";

          for (let tri = 0; tri < triCount; tri += 1) {
            const info = resource.triangleProperties?.[tri] || null;
            let resourceIdForTri = info?.resourceId ?? null;
            let propertyIds = Array.isArray(info?.propertyIds) && info.propertyIds.length === 3
              ? info.propertyIds
              : null;

            if ((!propertyIds || resourceIdForTri == null) && objectLevel?.ok) {
              resourceIdForTri = resourceIdForTri ?? objectLevel.resourceId;
              if (!propertyIds) {
                propertyIds = [
                  objectLevel.propertyId,
                  objectLevel.propertyId,
                  objectLevel.propertyId,
                ];
              }
            }

            const textureGroup = textureGroupMap.get(resourceIdForTri);
            const bucketKey = textureGroup ? resourceIdForTri : defaultKey;
            if (!buckets.has(bucketKey)) {
              buckets.set(bucketKey, {
                positions: [],
                uvs: [],
                colors: [],
              });
            }
            const bucket = buckets.get(bucketKey);

            const i0 = indices[tri * 3 + 0];
            const i1 = indices[tri * 3 + 1];
            const i2 = indices[tri * 3 + 2];

            const pushVertex = (index, uv, colorOffset) => {
              const base = index * 3;
              bucket.positions.push(
                positions[base],
                positions[base + 1],
                positions[base + 2]
              );
              if (uv) {
                bucket.uvs.push(uv.u, uv.v);
              }
              if (colorOffset != null && colorBuffer?.length) {
                bucket.colors.push(
                  colorBuffer[colorOffset],
                  colorBuffer[colorOffset + 1],
                  colorBuffer[colorOffset + 2]
                );
              }
            };

            if (textureGroup && propertyIds) {
              const coordsById = textureGroup.coordsById || new Map();
              const uv0 = coordsById.get(String(coerceTexturePid(textureGroup, propertyIds[0]))) || { u: 0, v: 0 };
              const uv1 = coordsById.get(String(coerceTexturePid(textureGroup, propertyIds[1]))) || { u: 0, v: 0 };
              const uv2 = coordsById.get(String(coerceTexturePid(textureGroup, propertyIds[2]))) || { u: 0, v: 0 };
              pushVertex(i0, uv0, null);
              pushVertex(i1, uv1, null);
              pushVertex(i2, uv2, null);
            } else {
              const colorOffset = tri * 9;
              pushVertex(i0, null, colorOffset);
              pushVertex(i1, null, colorOffset + 3);
              pushVertex(i2, null, colorOffset + 6);
            }
          }

          const groupMeshes = [];
          buckets.forEach((bucket, key) => {
            if (!bucket.positions.length) return;
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute(
              "position",
              new THREE.Float32BufferAttribute(bucket.positions, 3)
            );
            if (bucket.uvs.length) {
              geometry.setAttribute(
                "uv",
                new THREE.Float32BufferAttribute(bucket.uvs, 2)
              );
            }
            if (bucket.colors.length) {
              geometry.setAttribute(
                "color",
                new THREE.Float32BufferAttribute(bucket.colors, 3)
              );
            }
            geometry.computeVertexNormals();
            geometry.computeBoundingBox();
            geometry.computeBoundingSphere();

            let material = null;
            if (key !== defaultKey) {
              const textureGroup = textureGroupMap.get(key);
              const texture = textureGroup ? textureMap.get(textureGroup.textureId) : null;
              material = resource.material.clone();
              material.vertexColors = false;
              material.color = new THREE.Color("#ffffff");
              if (texture) {
                material.map = texture;
              }
            } else {
              material = resource.material.clone();
              if (bucket.colors.length) {
                material.vertexColors = true;
                material.color = new THREE.Color("#ffffff");
              } else {
                material.vertexColors = false;
                material.color = new THREE.Color(resource.baseColor);
              }
            }

            const suffix = key === defaultKey ? "" : "(Texture)";
            const mesh = buildMesh(geometry, material, suffix, key === defaultKey ? null : { textureGroupId: key });
            groupMeshes.push(mesh);
          });

          if (groupMeshes.length === 1) return groupMeshes[0];
          const group = new THREE.Group();
          groupMeshes.forEach((mesh) => group.add(mesh));
          group.name = deriveInstanceName(displayName, context);
          return group;
        }

        if (componentResources.has(resourceId)) {
          if (visited.has(resourceId)) return null;
          visited.add(resourceId);

          const resource = componentResources.get(resourceId);
          const displayName = normalizeName(
            { GetName: () => resource.name ?? null },
            resource.displayName
          );
          const groupInstance = new THREE.Group();
          groupInstance.name = deriveInstanceName(displayName, context);
          groupInstance.userData = {
            resourceId: resource.resourceId,
            uniqueResourceId: resource.uniqueResourceId ?? null,
            components: resource.components.map((component) => ({
              index: component.index,
              targetId: component.targetId,
              hasTransform: component.hasTransform,
              transform4x3: component.transform4x3,
              uuid: component.uuid ?? null,
              hasUUID: component.hasUUID ?? false,
            })),
            buildItemIndex: context.buildItemIndex,
            uuid: resource.uuid ?? null,
            hasUUID: resource.hasUUID ?? false,
            buildItemUuid: context.buildItemUuid ?? null,
          };
          if (Array.isArray(context.metadataEntries) && context.metadataEntries.length) {
            groupInstance.userData.metadataEntries = context.metadataEntries;
          }

          resource.components.forEach((component) => {
            const child = instantiateResource(
              component.targetId,
              {
                ...context,
                metadataEntries: undefined,
                transform43: component.transform4x3,
                transformLabel: component.hasTransform
                  ? `${displayName} · component ${component.index}`
                  : `${displayName} · component ${component.index} (identity)`,
                instanceName: undefined,
                componentPath: [
                  ...(context.componentPath || []),
                  {
                    resourceId: resource.resourceId,
                    componentIndex: component.index,
                    resourceUuid: resource.uuid ?? null,
                    componentUuid: component.uuid ?? null,
                  },
                ],
                buildItemUuid: context.buildItemUuid ?? null,
              },
              visited
            );
            if (child) {
              groupInstance.add(child);
            }
          });

          if (context.transform43) {
            applyTransformToObject(
              groupInstance,
              context.transformLabel || `Build item`,
              context.transform43
            );
          }

          visited.delete(resourceId);
          return groupInstance;
        }

        return null;
      };

      parsed.items.forEach((item) => {
        const instance = instantiateResource(item.resourceId, {
          buildItemIndex: item.index,
          metadataEntries: item.metadata,
          componentPath: [],
          transform43: item.transform,
          transformLabel: item.transform ? `Build item ${item.index}` : null,
          buildItemUuid: item.uuid,
          resourceUuid: item.objectUUID,
        });
        if (instance) {
          group.add(instance);
        }
      });

      if (!group.children.length) {
        throw new Error("No build items to render in 3MF file.");
      }

      const boundingBox = new THREE.Box3().setFromObject(group);
      if (!boundingBox.isEmpty()) {
        const center = boundingBox.getCenter(new THREE.Vector3());
        group.children.forEach((child) => {
          child.position.sub(center);
          child.updateMatrixWorld(true);
        });
        group.updateMatrixWorld(true);
      }

      const counts = {
        ...parsed.counts,
        meshResources: meshResources.size,
        meshes: parsed.meshResources.length,
        meshInstances: meshInstanceCount,
      };

      const diagnostics = parsed.diagnostics;

      const metadata = {
        fileName,
        meshCount: meshResources.size,
        unit: parsed.unit,
        lib3mfVersion: parsed.lib3mfVersion,
        specifications: parsed.specifications,
        primarySpecification: parsed.primarySpecification,
        specification: parsed.primarySpecification,
        specSupported: !!parsed.primarySpecification?.supported,
        counts,
        modelUUID: parsed.modelUUID,
        modelHasUUID: parsed.modelHasUUID,
        baseMaterialGroups: parsed.baseMaterialGroups,
        colorGroups: parsed.colorGroups,
        texture2Ds: parsed.texture2Ds,
        texture2DGroups: parsed.texture2DGroups,
        diagnostics,
        items: parsed.items,
      };

      const report = {
        file: fileName,
        lib3mfVersion: parsed.lib3mfVersion,
        specifications: parsed.specifications,
        primarySpecification: parsed.primarySpecification,
        diagnostics,
        summary: {
          unit: parsed.unit,
          counts,
          baseMaterialGroups: parsed.baseMaterialGroups,
          colorGroups: parsed.colorGroups,
          texture2Ds: parsed.texture2Ds,
          texture2DGroups: parsed.texture2DGroups,
          modelUUID: parsed.modelUUID,
          primarySpecification: parsed.primarySpecification,
          specification: parsed.primarySpecification,
          specifications: parsed.specifications,
        },
        items: parsed.items,
      };

      return {
        group,
        meshes,
        metadata,
        diagnostics,
        report,
      };
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
