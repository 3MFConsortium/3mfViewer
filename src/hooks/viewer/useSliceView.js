import { useEffect } from "react";
import * as THREE from "three";

const SLICE_PREVIEW_GROUP_NAME = "__slice_preview__";

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

const buildSlicePreviewGroup = (source, targetSlice) => {
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

  const resolveSlicePolygons = (slice) => {
    const polygons = Array.isArray(slice?.polygons) ? slice.polygons : [];
    const vertices = Array.isArray(slice?.vertices) ? slice.vertices : [];
    const resolved = polygons
      .map((polygon) => {
        const indices = Array.isArray(polygon?.indices) ? polygon.indices : [];
        const points = indices
          .map((index) => vertices[index])
          .filter(Boolean);
        return normalizePolygonPoints(points);
      })
      .filter((points) => points.length >= 3);

    if (resolved.length) return resolved;

    const direct = normalizePolygonPoints(vertices);
    if (direct.length >= 3) return [direct];

    const fallback = normalizePolygonPoints(fallbackVertices);
    return fallback.length >= 3 ? [fallback] : [];
  };

  const slice = stacks
    .map((stack) => (Array.isArray(stack?.slices) ? stack.slices[targetSlice] : null))
    .find(Boolean);
  if (!slice) return null;

  const polygons = resolveSlicePolygons(slice);
  if (!polygons.length) return null;

  const group = new THREE.Group();
  group.name = SLICE_PREVIEW_GROUP_NAME;

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

  const addLoop = (points, z) => {
    if (points.length < 2) return null;
    const positions = new Float32Array(points.length * 2 * 3);
    let offset = 0;
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      positions[offset++] = a.x - center.x;
      positions[offset++] = a.y - center.y;
      positions[offset++] = z - center.z;
      positions[offset++] = b.x - center.x;
      positions[offset++] = b.y - center.y;
      positions[offset++] = z - center.z;
    }
    return positions;
  };

  const z = Number.isFinite(Number(slice?.zTop)) ? Number(slice.zTop) : 0;
  polygons.forEach((polygonPoints, polygonIndex) => {
    const shape = new THREE.Shape(
      polygonPoints.map((point) => new THREE.Vector2(point.x - center.x, point.y - center.y))
    );
    const fillGeometry = new THREE.ShapeGeometry(shape);
    const fill = new THREE.Mesh(fillGeometry, fillMaterial);
    fill.position.z = z - center.z;
    fill.renderOrder = 2;
    fill.visible = true;
    fill.userData.isSliceFill = true;
    fill.userData.sliceIndex = targetSlice;
    fill.userData.slicePolygonIndex = polygonIndex;
    group.add(fill);

    const positions = addLoop(polygonPoints, z + 0.001);
    if (!positions) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const lines = new THREE.LineSegments(geometry, lineMaterial);
    lines.userData.isSliceLine = true;
    lines.userData.sliceIndex = targetSlice;
    lines.userData.slicePolygonIndex = polygonIndex;
    lines.renderOrder = 3;
    lines.visible = true;
    group.add(lines);
  });

  return group;
};

export const useSliceView = (sceneObject, sliceIndex, sliceMax) => {
  useEffect(() => {
    if (!sceneObject) return;
    const sliceViewActive = sliceIndex >= 0;
    const targetSlice = sliceIndex;

    const existingPreview = sceneObject.children.find((child) => child.name === SLICE_PREVIEW_GROUP_NAME);
    if (existingPreview) {
      sceneObject.remove(existingPreview);
      existingPreview.traverse((child) => {
        child.geometry?.dispose?.();
        if (Array.isArray(child.material)) {
          child.material.forEach((material) => material?.dispose?.());
        } else {
          child.material?.dispose?.();
        }
      });
    }

    sceneObject.traverse((child) => {
      if (child?.isMesh && !child.userData?.isSliceLine && !child.userData?.isSliceFill) {
        const material = child.material;
        if (!material) return;
        if (sliceViewActive) {
          if (!child.userData.originalMaterial) {
            child.userData.originalMaterial = {
              transparent: material.transparent,
              opacity: material.opacity,
              depthWrite: material.depthWrite,
            };
          }
          material.transparent = true;
          material.opacity = 0.15;
          material.depthWrite = false;
          material.needsUpdate = true;
        } else if (child.userData.originalMaterial) {
          const original = child.userData.originalMaterial;
          material.transparent = original.transparent;
          material.opacity = original.opacity;
          material.depthWrite = original.depthWrite;
          material.needsUpdate = true;
          delete child.userData.originalMaterial;
        }
      }
    });

    if (sliceViewActive) {
      const preview = buildSlicePreviewGroup(sceneObject.userData?.slicePreviewSource, targetSlice);
      if (preview) {
        sceneObject.add(preview);
      }
    }
  }, [sceneObject, sliceIndex, sliceMax]);
};
