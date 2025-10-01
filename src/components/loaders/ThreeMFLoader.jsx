import React, { useCallback, useMemo, useRef } from "react";
import * as THREE from "three";
import lib3mf from "@tensorgrad/lib3mf";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { ThreeMFLoaderContext } from "./ThreeMFLoaderContext.js";
import { normalizeName } from "../../lib/normalizeName.js";
import { loadThreeMFModel } from "../../lib/lib3mfEngine.js";

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

  const ensureLib3mf = useCallback(async () => {
    if (!lib3mfRef.current) {
      lib3mfRef.current = lib3mf();
    }
    return lib3mfRef.current;
  }, []);

  const load3mf = useCallback(
    async (arrayBuffer, fileName = "model.3mf", options = {}) => {
      const lib = await ensureLib3mf();

      const specificationUrls = options?.specificationUrls ??
        (options?.specificationUrl ? [options.specificationUrl] : undefined);

      const parsed = await loadThreeMFModel(lib, arrayBuffer, fileName, {
        specificationUrls
      });

      const palette = Array.isArray(options?.palette) && options.palette.length
        ? options.palette
        : DEFAULT_PALETTE;
      let paletteIndex = 0;

      const group = new THREE.Group();
      group.name = fileName?.replace(/\.[^/.]+$/, "") || "3MF Model";

      const meshResources = new Map();
      const componentResources = new Map();

      parsed.meshResources.forEach((resource) => {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(resource.positions, 3));
        geometry.setIndex(new THREE.BufferAttribute(resource.indices, 1));

        let processedGeometry = mergeVertices(geometry, 1e-6);
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
        if (resource.usesVertexColors && resource.vertexColors?.length) {
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
        });

        // Release raw buffers once we've promoted them into THREE resources.
        resource.positions = undefined;
        resource.indices = undefined;
        resource.vertexColors = undefined;
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
          const material = resource.material.clone();
          if (resource.usesVertexColors) {
            material.vertexColors = true;
            material.color = new THREE.Color("#ffffff");
          } else {
            material.vertexColors = false;
            material.color = new THREE.Color(resource.baseColor);
          }
          const mesh = new THREE.Mesh(resource.geometry, material);
          mesh.castShadow = true;
          mesh.receiveShadow = true;

          const displayName = normalizeName(
            { GetName: () => resource.name ?? null },
            resource.displayName
          );
          mesh.name = deriveInstanceName(displayName, context);
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
    [ensureLib3mf]
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
