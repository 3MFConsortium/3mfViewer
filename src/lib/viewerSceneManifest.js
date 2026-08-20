const finiteOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const compactBounds = (bounds) => {
  if (!bounds?.min || (!bounds?.max && !bounds?.size)) return null;
  const min = {
    x: finiteOrNull(bounds.min.x),
    y: finiteOrNull(bounds.min.y),
    z: finiteOrNull(bounds.min.z),
  };
  if (Object.values(min).some((value) => value === null)) return null;
  const suppliedSize = bounds.size
    ? {
        x: finiteOrNull(bounds.size.x),
        y: finiteOrNull(bounds.size.y),
        z: finiteOrNull(bounds.size.z),
      }
    : null;
  if (suppliedSize && Object.values(suppliedSize).some((value) => value === null)) return null;
  const max = bounds.max
    ? {
        x: finiteOrNull(bounds.max.x),
        y: finiteOrNull(bounds.max.y),
        z: finiteOrNull(bounds.max.z),
      }
    : {
        x: min.x + suppliedSize.x,
        y: min.y + suppliedSize.y,
        z: min.z + suppliedSize.z,
      };
  if (Object.values(max).some((value) => value === null)) return null;
  return {
    min,
    max,
    size: suppliedSize
      ? suppliedSize
      : {
          x: max.x - min.x,
          y: max.y - min.y,
          z: max.z - min.z,
        },
  };
};

export const flattenSceneTree = (treeItems = []) => {
  const flattened = [];
  const visit = (node, parentId = null) => {
    if (!node) return;
    flattened.push({ ...node, parentId });
    (node.children || []).forEach((child) => visit(child, node.id));
  };
  treeItems.forEach((node) => visit(node));
  return flattened;
};

export const matchesSceneTarget = (node, target = {}) => {
  const meta = node?.meta || {};
  if (target.nodeId != null && String(node.id) !== String(target.nodeId)) return false;
  if (target.visibilityId != null && String(node.visibilityId) !== String(target.visibilityId)) {
    return false;
  }
  if (target.instanceId != null && String(meta.instanceId) !== String(target.instanceId)) {
    return false;
  }
  const requestedResourceId = target.modelResourceId ?? target.resourceId;
  const canonicalResourceId = meta.modelResourceId ?? meta.resourceId;
  if (requestedResourceId != null && String(canonicalResourceId) !== String(requestedResourceId)) {
    return false;
  }
  if (target.uuid != null && String(meta.uuid) !== String(target.uuid)) return false;
  return Object.keys(target).length > 0;
};

export const resolveSceneTargets = (treeItems, target) =>
  flattenSceneTree(treeItems).filter((node) => matchesSceneTarget(node, target));

const compactDiagnostics = (diagnostics) => {
  if (!diagnostics || typeof diagnostics !== "object") return null;
  const strict = diagnostics.strict || {};
  const nonStrict = diagnostics.nonStrict || {};
  return {
    strict: {
      errorCount: Array.isArray(strict.errors) ? strict.errors.length : 0,
      warningCount: Array.isArray(strict.warnings) ? strict.warnings.length : 0,
    },
    nonStrict: {
      errorCount: Array.isArray(nonStrict.errors) ? nonStrict.errors.length : 0,
      warningCount: Array.isArray(nonStrict.warnings) ? nonStrict.warnings.length : 0,
    },
  };
};

export const buildSceneManifest = ({
  treeItems = [],
  sceneData,
  loadedName,
  bounds,
  hiddenMeshIds = [],
  selectedNodeId = null,
}) => {
  const nodes = flattenSceneTree(treeItems);
  const hidden = new Set(hiddenMeshIds.map(String));
  const resources = [
    ...(sceneData?.meshResources || []).map((resource) => ({ ...resource, type: "mesh" })),
    ...(sceneData?.componentResources || []).map((resource) => ({ ...resource, type: "components" })),
  ].map((resource) => ({
    modelResourceId: resource.modelResourceId ?? resource.resourceId ?? null,
    internalResourceId: resource.internalResourceId ?? resource.resourceId ?? null,
    uniqueResourceId: resource.uniqueResourceId ?? null,
    uuid: resource.uuid ?? null,
    name: resource.displayName || resource.name || null,
    type: resource.type,
    vertexCount: finiteOrNull(resource.vertexCount),
    triangleCount: finiteOrNull(resource.triangleCount),
    isBeamLattice: resource.isBeamLattice === true,
    diagnostics: resource.meshSummary
      ? {
          manifold: resource.meshSummary.isManifoldAndOriented ?? null,
          hasSlices: resource.meshSummary.hasSlices ?? false,
          sliceCount: resource.meshSummary.resolvedSliceCount ?? resource.meshSummary.sliceCount ?? null,
        }
      : null,
  }));

  const instances = nodes
    .filter((node) => node.type === "mesh")
    .map((node) => ({
      nodeId: node.id,
      visibilityId: node.visibilityId ?? null,
      instanceId: node.meta?.instanceId ?? null,
      modelResourceId: node.meta?.modelResourceId ?? node.meta?.resourceId ?? null,
      internalResourceId: node.meta?.internalResourceId ?? null,
      name: node.name,
      parentId: node.parentId,
      buildItemIndex: node.meta?.buildItemIndex ?? null,
      buildItemUuid: node.meta?.buildItemUuid ?? null,
      bounds: compactBounds(node.meta?.bounds),
      visible: !hidden.has(String(node.visibilityId ?? node.id)),
      selected: String(node.id) === String(selectedNodeId),
    }));

  const metadata = sceneData?.metadata || {};
  const materials = {
    baseMaterialGroups: (metadata.baseMaterialGroups || []).map((group) => ({
      modelResourceId: group.modelResourceId ?? group.groupId ?? null,
      internalResourceId: group.internalResourceId ?? group.groupId ?? null,
      uniqueResourceId: group.uniqueResourceId ?? null,
      count: finiteOrNull(group.count),
    })),
    colorGroups: (metadata.colorGroups || []).map((group) => ({
      modelResourceId: group.modelResourceId ?? group.groupId ?? null,
      internalResourceId: group.internalResourceId ?? group.groupId ?? null,
      uniqueResourceId: group.uniqueResourceId ?? null,
      count: finiteOrNull(group.count),
    })),
    textures: (metadata.texture2Ds || []).map((texture) => ({
      modelResourceId: texture.modelResourceId ?? texture.textureId ?? null,
      internalResourceId: texture.internalResourceId ?? texture.textureId ?? null,
      uniqueResourceId: texture.uniqueResourceId ?? null,
      contentType: texture.contentType ?? null,
      attachmentPath: texture.attachmentPath ?? null,
    })),
    textureGroups: (metadata.texture2DGroups || []).map((group) => ({
      modelResourceId: group.modelResourceId ?? group.groupId ?? null,
      internalResourceId: group.internalResourceId ?? group.groupId ?? null,
      uniqueResourceId: group.uniqueResourceId ?? null,
      textureModelResourceId: group.textureModelResourceId ?? group.textureId ?? null,
      coordinateCount: Array.isArray(group.coords) ? group.coords.length : 0,
    })),
  };

  const sliceStacks = (metadata.sliceStacks || []).map((stack) => ({
    modelResourceId: stack.modelResourceId ?? stack.resourceId ?? null,
    internalResourceId: stack.internalResourceId ?? stack.resourceId ?? null,
    uniqueResourceId: stack.uniqueResourceId ?? null,
    uuid: stack.uuid ?? null,
    sliceCount: finiteOrNull(stack.sliceCount),
    bottomZ: finiteOrNull(stack.bottomZ),
  }));

  return {
    model: {
      name: loadedName || sceneData?.metadata?.fileName || null,
      uuid: sceneData?.metadata?.modelUUID ?? null,
      unit: sceneData?.metadata?.unit ?? null,
      bounds: compactBounds(bounds),
      counts: sceneData?.metadata?.counts ?? null,
      diagnostics: compactDiagnostics(sceneData?.metadata?.diagnostics),
    },
    resources,
    instances,
    materials,
    sliceStacks,
  };
};
