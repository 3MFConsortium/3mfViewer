import * as THREE from "three";

export const getSceneBounds = (sceneObject) => {
  if (!sceneObject) return null;
  const box = new THREE.Box3().setFromObject(sceneObject);
  if (box.isEmpty()) return null;
  const size = box.getSize(new THREE.Vector3());
  const maxExtent = Math.max(size.x, size.y, size.z, 1);
  return {
    size,
    maxExtent,
    min: box.min.clone(),
  };
};

export const getSliceMax = (sceneData) => {
  const stacks = sceneData?.sliceStacks ?? [];
  if (!stacks.length) return -1;
  const max = stacks.reduce((acc, stack) => {
    const count = Number(stack?.sliceCount ?? 0);
    return Number.isFinite(count) ? Math.max(acc, count) : acc;
  }, 0);
  return max > 0 ? max - 1 : -1;
};

export const formatElapsed = (elapsedMs) => {
  if (!Number.isFinite(elapsedMs)) return "0s";
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
};
