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

  const showSceneTree = showScene && prefs.uiSceneTree;

  return (
    <>
      {showScene && (
        <Canvas
          shadows={prefs.shadows}
          camera={{ fov: 50, position: initialCamPos.current.toArray() }}
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          onCreated={({ camera, gl }) => {
            cameraRef.current = camera;
            rendererRef.current = gl;
            setCanvasElement(gl.domElement);
            gl.setClearColor(new THREE.Color(prefs.background), 1.0);
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
          <directionalLight
            position={[5, 8, 6]}
            intensity={prefs.directional}
            color={prefs.dirColor}
            castShadow={prefs.shadows}
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
            <mesh rotation-x={-Math.PI / 2} position={[0, groundY, 0]} receiveShadow>
              <planeGeometry args={[10000, 10000]} />
              <shadowMaterial opacity={prefs.shadows ? 0.2 : 0.0} />
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
