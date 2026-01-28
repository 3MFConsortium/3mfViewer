import { useEffect } from "react";

export const useSliceView = (sceneObject, sliceIndex, sliceMax) => {
  useEffect(() => {
    if (!sceneObject) return;
    const sliceViewActive = sliceIndex >= 0;
    const targetSlice = sliceIndex;

    sceneObject.traverse((child) => {
      if (child?.isMesh && !child.userData?.isSliceLine) {
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

      if (child?.userData?.isSliceLine) {
        child.visible = sliceViewActive && child.userData.sliceIndex === targetSlice;
      }
    });
  }, [sceneObject, sliceIndex, sliceMax]);
};
