import React from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

import { useViewerStore } from "../../stores/viewerStore.js";

import { SceneContent } from "../scene/SceneContent.jsx";
import { SceneTree } from "../ui/SceneTree.jsx";

export function ViewerScene({
  showScene,
  initialCamPos,
  initialTarget,
  controlsRef,
  cameraRef,
  rendererRef,
  setCanvasElement,
  contentRef,
  groundSize,
  groundY,
  gridDivisions,
  treeItems,
  onSelectFile,
  sceneMetadata,
  onUpdateSpecifications,
  hideSceneTree = false,
  transparentBackground = false,
}) {
  const prefs = useViewerStore((state) => state.prefs);
  const sceneObject = useViewerStore((state) => state.viewer.sceneObject);
  const loadStatus = useViewerStore((state) => state.viewer.loadStatus);
  const loadError = useViewerStore((state) => state.viewer.loadError);
  const loadedName = useViewerStore((state) => state.viewer.loadedName);
  const hiddenMeshIds = useViewerStore((state) => state.selection.hiddenMeshIds);
  const selectedNodeId = useViewerStore((state) => state.selection.selectedNodeId);
  const selectedNodeInfo = useViewerStore((state) => state.selection.selectedNodeInfo);
  const mobileNavOpen = useViewerStore((state) => state.ui.mobileNavOpen);
  const toggleMeshVisibility = useViewerStore((state) => state.toggleMeshVisibility);
  const setSelectedNode = useViewerStore((state) => state.setSelectedNode);
  const setMobileNavOpen = useViewerStore((state) => state.setMobileNavOpen);

  const showSceneTree = showScene && prefs.uiSceneTree && !hideSceneTree;

  return (
    <>
      {showScene && (
        <Canvas
          camera={{ fov: 50, position: initialCamPos.current.toArray() }}
          gl={{ preserveDrawingBuffer: true, antialias: true, alpha: transparentBackground }}
          onCreated={({ camera, gl }) => {
            cameraRef.current = camera;
            rendererRef.current = gl;
            setCanvasElement(gl.domElement);
            gl.setClearColor(new THREE.Color(prefs.background), transparentBackground ? 0.0 : 1.0);
            setTimeout(() => {
              if (controlsRef.current) {
                initialTarget.current.copy(controlsRef.current.target);
              }
            }, 0);
          }}
        >
          <OrbitControls
            ref={controlsRef}
            makeDefault
            enableDamping
            dampingFactor={0.08}
          />

          <ambientLight intensity={prefs.ambient} />
          <hemisphereLight
            intensity={prefs.hemiIntensity}
            color={prefs.hemiSkyColor}
            groundColor={prefs.hemiGroundColor}
          />
          <directionalLight
            intensity={prefs.rimIntensity}
            color={prefs.rimColor}
            position={[-6, 6, -6]}
          />

          <SceneContent
            object={sceneObject}
            contentRef={contentRef}
            renderOptions={{
              wireframe: prefs.wireframe,
              edges: prefs.edges,
              edgeColor: prefs.edgeColor,
            }}
            hiddenMeshIds={hiddenMeshIds}
          />

          {prefs.ground && (
            <mesh rotation-x={-Math.PI / 2} position={[0, groundY, 0]}>
              <planeGeometry args={[10000, 10000]} />
              <shadowMaterial opacity={0.0} />
            </mesh>
          )}
          {prefs.grid && (
            <gridHelper args={[10000, 500, 0x888888, 0xcccccc]} position={[0, groundY + 0.001, 0]} />
          )}
        </Canvas>
      )}

      {showSceneTree && (
        <>
          <SceneTree
            items={treeItems}
            onSelectFile={onSelectFile}
            loadStatus={loadStatus}
            fileName={loadedName}
            errorMessage={loadError}
            metadata={sceneMetadata}
            className="hidden lg:block"
            onSelectNode={setSelectedNode}
            selectedNodeId={selectedNodeId}
            selectedInfo={selectedNodeInfo}
            onToggleMeshVisibility={toggleMeshVisibility}
            hiddenMeshIds={hiddenMeshIds}
            onUpdateSpecifications={onUpdateSpecifications}
          />
          <SceneTree
            items={treeItems}
            onSelectFile={onSelectFile}
            loadStatus={loadStatus}
            fileName={loadedName}
            errorMessage={loadError}
            metadata={sceneMetadata}
            variant="drawer"
            open={mobileNavOpen}
            onClose={() => setMobileNavOpen(false)}
            className="lg:hidden"
            onSelectNode={setSelectedNode}
            selectedNodeId={selectedNodeId}
            selectedInfo={selectedNodeInfo}
            onToggleMeshVisibility={toggleMeshVisibility}
            hiddenMeshIds={hiddenMeshIds}
            onUpdateSpecifications={onUpdateSpecifications}
          />
        </>
      )}
    </>
  );
}
