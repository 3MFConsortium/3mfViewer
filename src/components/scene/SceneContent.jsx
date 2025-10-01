import { useEffect, useMemo } from "react";
import * as THREE from "three";

export function SceneContent({ object, contentRef, renderOptions, hiddenMeshIds = [] }) {
  const wireframe = !!renderOptions?.wireframe;
  const showEdges = !!renderOptions?.edges;
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
    object.traverse((child) => {
      if (!child.isMesh) return;
      child.visible = !hiddenSet.has(child.uuid);
    });
  }, [object, hiddenSet]);

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
        mat.wireframe = wireframe ? true : base;
      });

      let edgesHelper = child.userData.edgesHelper;
      if (showEdges) {
        if (!edgesHelper) {
          const geometry = child.geometry
            ? new THREE.EdgesGeometry(child.geometry)
            : null;
          if (geometry) {
            const material = new THREE.LineBasicMaterial({ color: edgeColor });
            edgesHelper = new THREE.LineSegments(geometry, material);
            edgesHelper.renderOrder = 1;
            edgesHelper.frustumCulled = true;
            child.add(edgesHelper);
            child.userData.edgesHelper = edgesHelper;
          }
        }
        if (edgesHelper) {
          edgesHelper.visible = true;
          if (edgesHelper.material?.color) {
            edgesHelper.material.color.set(edgeColor);
          }
        }
      } else if (edgesHelper) {
        edgesHelper.visible = false;
      }
    });
  }, [object, wireframe, showEdges, edgeColor]);

  return (
    <group ref={contentRef}>
      {object ? <primitive object={object} dispose={null} /> : null}
    </group>
  );
}
