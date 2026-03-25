import { useEffect, useMemo } from "react";
import * as THREE from "three";

export function SceneContent({ object, contentRef, renderOptions, hiddenMeshIds = [] }) {
  const wireframe = !!renderOptions?.wireframe;
  const showEdges = !!renderOptions?.edges;
  const edgeColor = renderOptions?.edgeColor || "#111827";
  const subtleEdgeColor = renderOptions?.subtleEdgeColor || "#64748b";
  const hiddenSet = useMemo(() => new Set(hiddenMeshIds), [hiddenMeshIds]);

  useEffect(() => {
    if (!object) return undefined;

    object.traverse((child) => {
      if (!child.isMesh) return;
      if (child.userData?.isBeamLatticeLines) return;
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
      if (child.userData?.isSliceLine) return;

      if (child.userData?.isBeamLatticeLines) {
        const idAttr = child.geometry?.getAttribute("virtualResourceId");
        if (idAttr) {
          const resourceIdsInMesh = new Set();
          for (let i = 0; i < idAttr.count; i += 1) {
            resourceIdsInMesh.add(idAttr.getX(i));
          }
          const anyHidden = [...resourceIdsInMesh].some(id => hiddenIds.has(id));
          child.visible = !anyHidden;
        } else {
          child.visible = true;
        }
      } else if (child.userData?.isBeamLattice) {
        const resourceId = child.userData.resourceId;
        child.visible = !hiddenIds.has(resourceId);
      } else if (child.userData?.resourceId !== undefined && child.userData?.resourceId !== null) {
        child.visible = !hiddenIds.has(Number(child.userData.resourceId));
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
        if (wireframe) {
          mat.wireframe = true;
        } else if (showEdges) {
          mat.wireframe = false;
        } else {
          mat.wireframe = base;
        }
        mat.userData.originalWireframe = base;
      });

      const edgesHelper = child.userData.edgesHelper;
      const shouldShowSubtleEdges = !wireframe;
      const desiredOpacity = showEdges ? 0.55 : shouldShowSubtleEdges ? 0.18 : 0;
      const desiredColor = showEdges ? edgeColor : subtleEdgeColor;

      if (desiredOpacity > 0) {
        if (!edgesHelper) {
          const geometry = new THREE.EdgesGeometry(child.geometry, 30);
          const material = new THREE.LineBasicMaterial({
            color: desiredColor,
            transparent: true,
            opacity: desiredOpacity,
          });
          const helper = new THREE.LineSegments(geometry, material);
          helper.renderOrder = 1;
          child.add(helper);
          child.userData.edgesHelper = helper;
          child.userData.edgesColor = desiredColor;
          child.userData.edgesOpacity = desiredOpacity;
        } else {
          if (child.userData.edgesColor !== desiredColor) {
            edgesHelper.material.color.set(desiredColor);
            child.userData.edgesColor = desiredColor;
          }
          if (child.userData.edgesOpacity !== desiredOpacity) {
            edgesHelper.material.opacity = desiredOpacity;
            child.userData.edgesOpacity = desiredOpacity;
          }
        }
      } else if (edgesHelper) {
        child.remove(edgesHelper);
        edgesHelper.geometry?.dispose();
        edgesHelper.material?.dispose();
        delete child.userData.edgesHelper;
        delete child.userData.edgesColor;
        delete child.userData.edgesOpacity;
      }
    });
  }, [object, wireframe, showEdges, edgeColor, subtleEdgeColor, hiddenSet]);

  return (
    <group ref={contentRef}>
      {object ? <primitive object={object} dispose={null} /> : null}
    </group>
  );
}
