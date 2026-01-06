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
    const hiddenIds = new Set(
      hiddenMeshIds
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
    );
    object.traverse((child) => {
      if (!child.isMesh) return;
      if (child.userData?.isSliceLine) return; // Skip slice lines

      if (child.userData?.virtualMesh) {
        // For virtual meshes (flattened geometry), check if ANY resource in the mesh is hidden
        const idAttr = child.geometry?.getAttribute("virtualResourceId");
        if (idAttr) {
          // Collect unique resource IDs in this mesh
          const resourceIdsInMesh = new Set();
          for (let i = 0; i < idAttr.count; i += 1) {
            resourceIdsInMesh.add(idAttr.getX(i));
          }
          // Hide mesh if ALL its resources are hidden, show if any are visible
          const allHidden = [...resourceIdsInMesh].every(id => hiddenIds.has(id));
          const anyHidden = [...resourceIdsInMesh].some(id => hiddenIds.has(id));
          // For single-resource meshes, this works perfectly
          // For multi-resource meshes, hide if any resource is hidden (best we can do without custom shader)
          child.visible = !anyHidden;
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
      if (showEdges) {
        if (!edgesHelper) {
          const geometry = new THREE.EdgesGeometry(child.geometry);
          const material = new THREE.LineBasicMaterial({ color: edgeColor });
          const helper = new THREE.LineSegments(geometry, material);
          helper.renderOrder = 1;
          child.add(helper);
          child.userData.edgesHelper = helper;
          child.userData.edgesColor = edgeColor;
        } else if (child.userData.edgesColor !== edgeColor) {
          edgesHelper.material.color.set(edgeColor);
          child.userData.edgesColor = edgeColor;
        }
      } else if (edgesHelper) {
        child.remove(edgesHelper);
        edgesHelper.geometry?.dispose();
        edgesHelper.material?.dispose();
        delete child.userData.edgesHelper;
        delete child.userData.edgesColor;
      }
    });
  }, [object, wireframe, showEdges, edgeColor, hiddenSet]);

  return (
    <group ref={contentRef}>
      {object ? <primitive object={object} dispose={null} /> : null}
    </group>
  );
}
