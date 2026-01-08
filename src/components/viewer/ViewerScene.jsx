import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

import { useViewerStore } from "../../stores/viewerStore.js";

import { SceneContent } from "../scene/SceneContent.jsx";

/**
 * Detects when the first frame with geometry is rendered.
 * Sets renderReady to true after confirming geometry is visible.
 */
function RenderReadyDetector({ hasGeometry }) {
  const setRenderReady = useViewerStore((state) => state.setRenderReady);
  const frameCountRef = useRef(0);
  const signalledRef = useRef(false);

  // Reset when geometry changes
  useEffect(() => {
    if (!hasGeometry) {
      signalledRef.current = false;
      frameCountRef.current = 0;
    }
  }, [hasGeometry]);

  useFrame(() => {
    if (!hasGeometry || signalledRef.current) return;

    // Wait for 2 frames to ensure geometry is fully rendered
    // (first frame may still be compiling shaders)
    frameCountRef.current += 1;
    if (frameCountRef.current >= 2) {
      signalledRef.current = true;
      setRenderReady(true);
    }
  });

  return null;
}

export function ViewerScene({
  showScene,
  initialCamPos,
  initialTarget,
  controlsRef,
  cameraRef,
  rendererRef,
  setCanvasElement,
  contentRef,
  groundY,
  transparentBackground = false,
}) {
  const prefs = useViewerStore((state) => state.prefs);
  const sceneObject = useViewerStore((state) => state.viewer.sceneObject);
  const hiddenMeshIds = useViewerStore((state) => state.selection.hiddenMeshIds);

  return (
    <>
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

        {showScene && (
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
        )}

        {showScene && prefs.ground && (
          <mesh rotation-x={-Math.PI / 2} position={[0, groundY, 0]}>
            <planeGeometry args={[10000, 10000]} />
            <shadowMaterial opacity={0.0} />
          </mesh>
        )}
        {showScene && prefs.grid && (
          <gridHelper args={[10000, 500, 0x888888, 0xcccccc]} position={[0, groundY + 0.001, 0]} />
        )}

        <RenderReadyDetector hasGeometry={showScene && !!sceneObject} />
      </Canvas>
    </>
  );
}
