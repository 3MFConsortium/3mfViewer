import { useEffect } from "react";
import * as THREE from "three";

const SLICE_OVERVIEW_GROUP_NAME = "__slice_overview__";
const SLICE_SELECTION_GROUP_NAME = "__slice_selection__";

const normalizePolygonPoints = (points) => {
  if (!Array.isArray(points) || points.length < 3) return [];
  const normalized = points
    .map((point) => ({
      x: Number(point?.x),
      y: Number(point?.y),
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

  if (normalized.length >= 2) {
    const first = normalized[0];
    const last = normalized[normalized.length - 1];
    if (first.x === last.x && first.y === last.y) {
      normalized.pop();
    }
  }
  return normalized;
};

const containsPoint = (polygon, point) => {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses = (a.y > point.y) !== (b.y > point.y);
    if (crosses && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
};

export const groupSlicePolygonLoops = (polygons) => {
  const loops = polygons.map((points, index) => {
    const containers = polygons
      .map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
      .filter(({ candidate, candidateIndex }) => candidateIndex !== index && containsPoint(candidate, points[0]))
      .map(({ candidateIndex }) => candidateIndex);
    return { points, index, containers, depth: containers.length };
  });

  return loops
    .filter(({ depth }) => depth % 2 === 0)
    .map((outer) => ({
      outer: outer.points,
      holes: loops
        .filter(({ depth, containers }) =>
          depth === outer.depth + 1 && containers.includes(outer.index)
        )
        .map(({ points }) => points),
    }));
};

const resolveSlicePolygons = (slice, fallbackVertices = []) => {
  const polygons = Array.isArray(slice?.polygons) ? slice.polygons : [];
  const vertices = Array.isArray(slice?.vertices) ? slice.vertices : [];
  const resolved = polygons
    .map((polygon) => {
      const indices = Array.isArray(polygon?.indices) ? polygon.indices : [];
      return normalizePolygonPoints(indices.map((index) => vertices[index]).filter(Boolean));
    })
    .filter((points) => points.length >= 3);

  if (resolved.length) return resolved;

  const direct = normalizePolygonPoints(vertices);
  if (direct.length >= 3) return [direct];

  const fallback = normalizePolygonPoints(fallbackVertices);
  return fallback.length >= 3 ? [fallback] : [];
};

const appendLoopSegments = (positions, points, z, center) => {
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    positions.push(
      a.x - center.x,
      a.y - center.y,
      z - center.z,
      b.x - center.x,
      b.y - center.y,
      z - center.z
    );
  }
};

export const buildSliceContourPositions = (source) => {
  if (!source) return new Float32Array();
  const stacks = Array.isArray(source.sliceStacks) ? source.sliceStacks : [];
  const center = source.center || { x: 0, y: 0, z: 0 };
  const positions = [];

  stacks.forEach((stack) => {
    const slices = Array.isArray(stack?.slices) ? stack.slices : [];
    slices.forEach((slice) => {
      const z = Number(slice?.zTop);
      if (!Number.isFinite(z)) return;
      resolveSlicePolygons(slice).forEach((loop) => appendLoopSegments(positions, loop, z, center));
    });
  });

  return new Float32Array(positions);
};

const buildSliceOverviewGroup = (source) => {
  const positions = buildSliceContourPositions(source);
  if (!positions.length) return null;

  const group = new THREE.Group();
  group.name = SLICE_OVERVIEW_GROUP_NAME;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0x475569,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    depthTest: true,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.userData.isSliceLine = true;
  lines.renderOrder = 1;
  group.add(lines);
  return group;
};

const buildSelectedSliceGroup = (source, targetSlice) => {
  if (!source || targetSlice < 0) return null;
  const stacks = Array.isArray(source.sliceStacks) ? source.sliceStacks : [];
  const center = source.center || { x: 0, y: 0, z: 0 };
  const bounds = source.fallbackBounds;
  const fallbackVertices = bounds?.min && bounds?.max
    ? [
        { x: bounds.min.x, y: bounds.min.y },
        { x: bounds.max.x, y: bounds.min.y },
        { x: bounds.max.x, y: bounds.max.y },
        { x: bounds.min.x, y: bounds.max.y },
      ]
    : [];
  const selectedSlices = stacks
    .map((stack) => (Array.isArray(stack?.slices) ? stack.slices[targetSlice] : null))
    .filter(Boolean);
  if (!selectedSlices.length) return null;

  const group = new THREE.Group();
  group.name = SLICE_SELECTION_GROUP_NAME;

  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x0f172a,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    depthTest: false,
  });
  const fillMaterial = new THREE.MeshBasicMaterial({
    color: 0x0ea5e9,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
  });

  selectedSlices.forEach((slice, stackIndex) => {
    const z = Number.isFinite(Number(slice?.zTop)) ? Number(slice.zTop) : 0;
    const polygons = resolveSlicePolygons(slice, fallbackVertices);
    groupSlicePolygonLoops(polygons).forEach(({ outer, holes }, polygonIndex) => {
      const shape = new THREE.Shape(
        outer.map((point) => new THREE.Vector2(point.x - center.x, point.y - center.y))
      );
      holes.forEach((hole) => {
        shape.holes.push(new THREE.Path(
          hole.map((point) => new THREE.Vector2(point.x - center.x, point.y - center.y))
        ));
      });
      const fillGeometry = new THREE.ShapeGeometry(shape);
      const fill = new THREE.Mesh(fillGeometry, fillMaterial);
      fill.position.z = z - center.z;
      fill.renderOrder = 2;
      fill.userData.isSliceFill = true;
      fill.userData.sliceIndex = targetSlice;
      fill.userData.sliceStackIndex = stackIndex;
      fill.userData.slicePolygonIndex = polygonIndex;
      group.add(fill);

      [outer, ...holes].forEach((loop) => {
        const positions = [];
        appendLoopSegments(positions, loop, z + 0.001, center);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        const lines = new THREE.LineSegments(geometry, lineMaterial);
        lines.userData.isSliceLine = true;
        lines.userData.sliceIndex = targetSlice;
        lines.userData.sliceStackIndex = stackIndex;
        lines.userData.slicePolygonIndex = polygonIndex;
        lines.renderOrder = 3;
        group.add(lines);
      });
    });
  });

  return group;
};

const removeSliceGroup = (sceneObject, name) => {
  const group = sceneObject?.children.find((child) => child.name === name);
  if (!group) return;
  sceneObject.remove(group);
  group.traverse((child) => {
    child.geometry?.dispose?.();
    if (Array.isArray(child.material)) {
      child.material.forEach((material) => material?.dispose?.());
    } else {
      child.material?.dispose?.();
    }
  });
};

export const setSliceSourceHidden = (sceneObject, hidden) => {
  sceneObject?.traverse((child) => {
    if (!child?.isMesh || child.userData?.isSliceFill) return;
    if (hidden) {
      if (child.userData.sliceViewOriginalVisibility === undefined) {
        child.userData.sliceViewOriginalVisibility = child.visible;
      }
      child.userData.sliceViewHidden = true;
      child.visible = false;
      return;
    }
    if (child.userData.sliceViewOriginalVisibility !== undefined) {
      child.visible = child.userData.sliceViewRestoreVisibility
        ?? child.userData.sliceViewOriginalVisibility;
      delete child.userData.sliceViewOriginalVisibility;
      delete child.userData.sliceViewRestoreVisibility;
    }
    delete child.userData.sliceViewHidden;
  });
};

export const useSliceView = (sceneObject, sliceIndex, sliceMax, showOverview = true) => {
  const sliceViewActive = sliceIndex >= 0;

  useEffect(() => {
    if (!sceneObject) return;
    removeSliceGroup(sceneObject, SLICE_OVERVIEW_GROUP_NAME);

    setSliceSourceHidden(sceneObject, sliceViewActive);

    if (sliceViewActive && showOverview) {
      const overview = buildSliceOverviewGroup(sceneObject.userData?.slicePreviewSource);
      if (overview) sceneObject.add(overview);
    }

    return () => removeSliceGroup(sceneObject, SLICE_OVERVIEW_GROUP_NAME);
  }, [sceneObject, sliceMax, sliceViewActive, showOverview]);

  useEffect(() => {
    if (!sceneObject) return;
    removeSliceGroup(sceneObject, SLICE_SELECTION_GROUP_NAME);
    if (sliceViewActive) {
      const selection = buildSelectedSliceGroup(sceneObject.userData?.slicePreviewSource, sliceIndex);
      if (selection) sceneObject.add(selection);
    }
    return () => removeSliceGroup(sceneObject, SLICE_SELECTION_GROUP_NAME);
  }, [sceneObject, sliceIndex, sliceViewActive]);
};
