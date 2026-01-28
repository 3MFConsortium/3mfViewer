import { useMemo } from "react";

export const useSceneTreeItems = (sceneData, sceneObject) =>
  useMemo(() => {
    if (sceneData?.meshResources?.length && sceneData?.items?.length) {
      const meshMap = new Map(
        sceneData.meshResources.map((resource) => [resource.resourceId, resource])
      );
      const componentMap = new Map(
        (sceneData.componentResources || []).map((resource) => [resource.resourceId, resource])
      );

      const buildMeshNode = (resource, context) => {
        const instanceKey = context.instanceKey ?? String(resource.resourceId);
        const id = `mesh-${resource.resourceId}-${instanceKey}`;
        const meta = {
          vertexCount: resource.vertexCount,
          triangleCount: resource.triangleCount,
          resourceId: resource.resourceId,
          uniqueResourceId: resource.uniqueResourceId ?? null,
          uuid: resource.uuid ?? null,
          hasUUID: resource.hasUUID ?? false,
          meshDiagnostics: resource.meshSummary,
          materialColorStats: resource.materialColorStats,
          objectLevelProperty: resource.objectLevelProperty,
          buildItemIndex: context.buildItemIndex,
          buildItemUuid: context.buildItemUuid ?? null,
          resourceUuid: context.resourceUuid ?? null,
        };
        if (Array.isArray(context.metadataEntries) && context.metadataEntries.length) {
          meta.metadataEntries = context.metadataEntries;
        }
        if (context.transform43) {
          meta.transforms = [
            {
              label: context.transformLabel || `Build item ${context.buildItemIndex ?? ""}`.trim(),
              matrix4x3: context.transform43,
            },
          ];
        }
        return {
          id,
          visibilityId: String(resource.resourceId),
          name: resource.displayName || resource.name || `Mesh ${resource.resourceId ?? "?"}`,
          type: "mesh",
          isOpenByDefault: false,
          children: [],
          meta,
        };
      };

      const buildComponentNode = (resource, context, visited) => {
        const instanceKey = context.instanceKey ?? String(resource.resourceId);
        const id = `group-${resource.resourceId}-${instanceKey}`;
        const meta = {
          resourceId: resource.resourceId,
          uniqueResourceId: resource.uniqueResourceId ?? null,
          uuid: resource.uuid ?? null,
          hasUUID: resource.hasUUID ?? false,
          buildItemIndex: context.buildItemIndex,
          buildItemUuid: context.buildItemUuid ?? null,
          resourceUuid: context.resourceUuid ?? null,
          components: resource.components?.map((component) => ({
            index: component.index,
            targetId: component.targetId,
            hasTransform: component.hasTransform,
            transform4x3: component.transform4x3,
            uuid: component.uuid ?? null,
            hasUUID: component.hasUUID ?? false,
          })),
        };
        if (Array.isArray(context.metadataEntries) && context.metadataEntries.length) {
          meta.metadataEntries = context.metadataEntries;
        }
        if (context.transform43) {
          meta.transforms = [
            {
              label: context.transformLabel || `Build item ${context.buildItemIndex ?? ""}`.trim(),
              matrix4x3: context.transform43,
            },
          ];
        }

        const children = [];
        resource.components?.forEach((component) => {
          if (visited.has(component.targetId)) return;
          const child = buildResourceNode(
            component.targetId,
            {
              ...context,
              instanceKey: `${instanceKey}-${component.index}`,
              metadataEntries: undefined,
              transform43: component.transform4x3,
              transformLabel: component.hasTransform
                ? `${resource.displayName || "Component"} · ${component.index}`
                : `${resource.displayName || "Component"} · ${component.index} (identity)`,
              componentPath: [
                ...(context.componentPath || []),
                {
                  resourceId: resource.resourceId,
                  componentIndex: component.index,
                  resourceUuid: resource.uuid ?? null,
                  componentUuid: component.uuid ?? null,
                },
              ],
            },
            visited
          );
          if (child) children.push(child);
        });

        return {
          id,
          name: resource.displayName || resource.name || `Component ${resource.resourceId ?? "?"}`,
          type: "group",
          isOpenByDefault: true,
          children,
          meta,
        };
      };

      const buildResourceNode = (resourceId, context = {}, visited = new Set()) => {
        if (meshMap.has(resourceId)) {
          return buildMeshNode(meshMap.get(resourceId), context);
        }
        if (componentMap.has(resourceId)) {
          if (visited.has(resourceId)) return null;
          visited.add(resourceId);
          const node = buildComponentNode(componentMap.get(resourceId), context, visited);
          visited.delete(resourceId);
          return node;
        }
        return null;
      };

      return sceneData.items
        .map((item) =>
          buildResourceNode(item.resourceId, {
            buildItemIndex: item.index,
            buildItemUuid: item.uuid ?? null,
            metadataEntries: item.metadata,
            transform43: item.transform,
            transformLabel: item.transform ? `Build item ${item.index}` : null,
            instanceKey: `item-${item.index}`,
            resourceUuid: item.objectUUID ?? null,
            componentPath: [],
          })
        )
        .filter(Boolean);
    }

    if (!sceneObject) return [];

    const toTreeNode = (obj, isRoot = false) => {
      const children = (obj.children || [])
        .map((child) => toTreeNode(child, false))
        .filter(Boolean);

      const type = obj.isMesh ? "mesh" : obj.isLight ? "light" : "group";
      const name = obj.name || (obj.isMesh ? "Mesh" : obj.type);

      if (!obj.isMesh && children.length === 0 && !isRoot) return null;

      const meta = {};
      if (obj.isMesh) {
        if (typeof obj.userData?.vertexCount === "number") {
          meta.vertexCount = obj.userData.vertexCount;
        }
        if (typeof obj.userData?.triangleCount === "number") {
          meta.triangleCount = obj.userData.triangleCount;
        }
        if (obj.userData?.baseColor) {
          meta.color = obj.userData.baseColor;
        }
        if (obj.userData?.resourceId !== undefined) {
          meta.resourceId = obj.userData.resourceId;
        }
        if (obj.userData?.uniqueResourceId !== undefined) {
          meta.uniqueResourceId = obj.userData.uniqueResourceId;
        }
        if (obj.userData?.uuid) {
          meta.uuid = obj.userData.uuid;
        }
        if (obj.userData?.buildItemUuid) {
          meta.buildItemUuid = obj.userData.buildItemUuid;
        }
        if (obj.userData?.hasUUID !== undefined) {
          meta.hasUUID = obj.userData.hasUUID;
        }
        if (Array.isArray(obj.userData?.metadataEntries) && obj.userData.metadataEntries.length) {
          meta.metadataEntries = obj.userData.metadataEntries;
        }
        if (obj.userData?.meshDiagnostics) {
          meta.meshDiagnostics = obj.userData.meshDiagnostics;
        }
        if (Array.isArray(obj.userData?.components) && obj.userData.components.length) {
          meta.components = obj.userData.components;
        }
        if (Array.isArray(obj.userData?.transforms) && obj.userData.transforms.length) {
          meta.transforms = obj.userData.transforms;
        }
        if (
          Array.isArray(obj.userData?.materialResourceIds) &&
          obj.userData.materialResourceIds.length
        ) {
          meta.materialResourceIds = obj.userData.materialResourceIds;
        }
        if (obj.userData?.materialColorStats) {
          meta.materialColorStats = obj.userData.materialColorStats;
        }
        if (obj.userData?.objectLevelProperty) {
          meta.objectLevelProperty = obj.userData.objectLevelProperty;
        }
      } else {
        meta.childCount = children.length;
        if (obj.userData?.resourceId !== undefined) {
          meta.resourceId = obj.userData.resourceId;
        }
        if (obj.userData?.uniqueResourceId !== undefined) {
          meta.uniqueResourceId = obj.userData.uniqueResourceId;
        }
        if (obj.userData?.uuid) {
          meta.uuid = obj.userData.uuid;
        }
        if (obj.userData?.buildItemUuid) {
          meta.buildItemUuid = obj.userData.buildItemUuid;
        }
        if (obj.userData?.hasUUID !== undefined) {
          meta.hasUUID = obj.userData.hasUUID;
        }
        if (Array.isArray(obj.userData?.metadataEntries) && obj.userData.metadataEntries.length) {
          meta.metadataEntries = obj.userData.metadataEntries;
        }
        if (Array.isArray(obj.userData?.components) && obj.userData.components.length) {
          meta.components = obj.userData.components;
        }
        if (Array.isArray(obj.userData?.transforms) && obj.userData.transforms.length) {
          meta.transforms = obj.userData.transforms;
        }
      }

      return {
        id: obj.uuid,
        name,
        type,
        isOpenByDefault: type === "group",
        children,
        meta,
      };
    };

    return [toTreeNode(sceneObject, true)].filter(Boolean);
  }, [sceneData, sceneObject]);
