import React from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

import { SceneContent } from "../scene/SceneContent.jsx";
import { SceneTree } from "../ui/SceneTree.jsx";

export function ViewerScene({
  showScene,
  prefs,
  initialCamPos,
  initialTarget,
  controlsRef,
  cameraRef,
  rendererRef,
  setCanvasElement,
  contentRef,
  sceneObject,
  hiddenMeshIds,
  groundSize,
  groundY,
  gridDivisions,
  showSceneTree,
  treeItems,
  onSelectFile,
  loadStatus,
  loadedName,
  loadError,
  sceneMetadata,
  onSelectNode,
  selectedNodeId,
  selectedNodeInfo,
  onToggleMeshVisibility,
  mobileNavOpen,
  onCloseNav,
  onUpdateSpecifications,
  specificationResults,
}) {
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
              <planeGeometry args={[groundSize, groundSize]} />
              <shadowMaterial opacity={prefs.shadows ? 0.2 : 0.0} />
            </mesh>
          )}
          {prefs.grid && (
            <gridHelper args={[groundSize, gridDivisions]} position={[0, groundY + 0.001, 0]} />
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
            specificationResults={specificationResults}
            className="hidden lg:block"
            onSelectNode={onSelectNode}
            selectedNodeId={selectedNodeId}
            selectedInfo={selectedNodeInfo}
            onToggleMeshVisibility={onToggleMeshVisibility}
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
            onClose={onCloseNav}
            specificationResults={specificationResults}
            className="lg:hidden"
            onSelectNode={onSelectNode}
            selectedNodeId={selectedNodeId}
            selectedInfo={selectedNodeInfo}
            onToggleMeshVisibility={onToggleMeshVisibility}
            hiddenMeshIds={hiddenMeshIds}
            onUpdateSpecifications={onUpdateSpecifications}
          />
        </>
      )}
    </>
  );
}
