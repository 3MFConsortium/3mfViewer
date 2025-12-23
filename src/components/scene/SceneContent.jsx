import { useEffect, useMemo } from "react";
import * as THREE from "three";

export function SceneContent({ object, contentRef, renderOptions, hiddenMeshIds = [] }) {
  const wireframe = !!renderOptions?.wireframe;
  const showEdges = false;
  const edgeColor = renderOptions?.edgeColor || "#111827";
  const hiddenSet = useMemo(() => new Set(hiddenMeshIds), [hiddenMeshIds]);

  useEffect(() => {
    if (!object) return undefined;

    object.traverse((child) => {
      if (!child.isMesh) return;
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      materials.forEach((mat) => {
        if (!mat) return;
        if (mat.userData.originalWireframe === undefined) {
          mat.userData.originalWireframe = !!mat.wireframe;
        }
      });
    });

    return () => {
      object.traverse((child) => {
        if (!child.isMesh) return;
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        materials.forEach((mat) => {
          if (!mat) return;
          if (mat.userData.originalWireframe !== undefined) {
            mat.wireframe = mat.userData.originalWireframe;
          }
        });

        const edgesHelper = child.userData.edgesHelper;
        if (edgesHelper) {
          child.remove(edgesHelper);
          edgesHelper.geometry?.dispose();
          edgesHelper.material?.dispose();
          delete child.userData.edgesHelper;
        }
      });
    };
  }, [object]);

  useEffect(() => {
    if (!object) return;
    const hiddenIds = new Set(
      hiddenMeshIds
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
    );
    object.traverse((child) => {
      if (!child.isMesh) return;
      if (child.userData?.virtualMesh) {
        const visibilityAttr = child.geometry?.getAttribute("virtualVisibility");
        const idAttr = child.geometry?.getAttribute("virtualResourceId");
        const useTextureAttr = child.geometry?.getAttribute("virtualUseTexture");
        const hasTextureAttr = child.geometry?.getAttribute("virtualHasTexture");
        if (visibilityAttr && idAttr && useTextureAttr && hasTextureAttr) {
          for (let i = 0; i < idAttr.count; i += 1) {
            const resourceId = idAttr.getX(i);
            const hidden = hiddenIds.has(resourceId);
            const textured = hasTextureAttr.getX(i) > 0.5;
            if (hidden && textured) {
              visibilityAttr.setX(i, 1);
              useTextureAttr.setX(i, 0);
            } else if (hidden) {
              visibilityAttr.setX(i, 0);
              useTextureAttr.setX(i, textured ? 1 : 0);
            } else {
              visibilityAttr.setX(i, 1);
              useTextureAttr.setX(i, textured ? 1 : 0);
            }
          }
          visibilityAttr.updateRange.offset = 0;
          visibilityAttr.updateRange.count = visibilityAttr.count;
          useTextureAttr.updateRange.offset = 0;
          useTextureAttr.updateRange.count = useTextureAttr.count;
          visibilityAttr.needsUpdate = true;
          useTextureAttr.needsUpdate = true;
        }
      } else {
        child.visible = !hiddenSet.has(child.uuid);
      }
    });
  }, [object, hiddenSet, hiddenMeshIds]);

  useEffect(() => {
    if (!object) return;

    object.traverse((child) => {
      if (!child.isMesh) return;

      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      materials.forEach((mat) => {
        if (!mat) return;
        const base = mat.userData.originalWireframe ?? false;
        mat.wireframe = false;
        mat.userData.originalWireframe = base;
      });

      const edgesHelper = child.userData.edgesHelper;
      if (edgesHelper) {
        child.remove(edgesHelper);
        edgesHelper.geometry?.dispose();
        edgesHelper.material?.dispose();
        delete child.userData.edgesHelper;
      }
    });
  }, [object, wireframe, showEdges, edgeColor, hiddenSet]);

  return (
    <group ref={contentRef}>
      {object ? <primitive object={object} dispose={null} /> : null}
    </group>
  );
}
