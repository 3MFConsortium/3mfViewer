import { useCallback, useEffect, useRef } from "react";
import * as THREE from "three";

export const calculateFitDistance = (size, verticalFovDegrees, aspect, padding = 1.15) => {
  const radius = Math.hypot(size.x, size.y, size.z) / 2;
  if (!Number.isFinite(radius) || radius <= 0) return 0;
  const verticalFov = THREE.MathUtils.degToRad(verticalFovDegrees);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(aspect, 0.01));
  const limitingFov = Math.min(verticalFov, horizontalFov);
  return padding * radius / Math.sin(Math.max(limitingFov / 2, 0.001));
};

export const useCameraControls = ({
  controlsRef,
  cameraRef,
  contentRef,
  rendererRef,
  sceneObject,
  loadStatus,
}) => {
  const initialCamPos = useRef(new THREE.Vector3(6, 5, 8));
  const initialTarget = useRef(new THREE.Vector3(0, 0, 0));
  const fitRafRef = useRef(0);

  const DOLLY_STEP = 1.2;
  const handleZoomIn = useCallback(() => {
    controlsRef.current?.dollyOut(DOLLY_STEP);
  }, [controlsRef]);
  const handleZoomOut = useCallback(() => {
    controlsRef.current?.dollyIn(DOLLY_STEP);
  }, [controlsRef]);

  const handleFit = useCallback(() => {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    const content = contentRef.current;
    if (!controls || !camera || !content) return;

    const box = new THREE.Box3().setFromObject(content);
    if (box.isEmpty()) return;

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = size.length() / 2;
    const distance = calculateFitDistance(size, camera.fov, camera.aspect);
    if (!distance) return;
    const direction = new THREE.Vector3()
      .subVectors(camera.position, controls.target)
    if (direction.lengthSq() < Number.EPSILON) direction.set(1, 0.8, 1);
    direction.normalize();

    controls.target.copy(center);
    camera.position.copy(center).addScaledVector(direction, distance);
    camera.near = Math.max(0.001, (distance - radius) / 100);
    camera.far = Math.max(1000, (distance + radius) * 10);
    camera.updateProjectionMatrix();
    controls.update();
  }, [cameraRef, contentRef, controlsRef]);

  const handleResetView = useCallback(() => {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!controls || !camera) return;
    controls.target.copy(initialTarget.current);
    camera.position.copy(initialCamPos.current);
    camera.near = 0.1;
    camera.far = 1000;
    camera.updateProjectionMatrix();
    controls.update();
  }, [cameraRef, controlsRef]);

  const panByPixels = useCallback(
    (dxPx, dyPx) => {
      const controls = controlsRef.current;
      const camera = cameraRef.current;
      const r = rendererRef.current;
      if (!controls || !camera || !r) return;

      const distance = camera.position.distanceTo(controls.target);
      const fovRad = (camera.fov * Math.PI) / 180;
      const viewportH = 2 * Math.tan(fovRad / 2) * distance;
      const viewportW = viewportH * camera.aspect;

      const moveX = (dxPx / r.domElement.clientWidth) * viewportW;
      const moveY = (dyPx / r.domElement.clientHeight) * viewportH;

      const xAxis = new THREE.Vector3()
        .setFromMatrixColumn(camera.matrix, 0)
        .multiplyScalar(-moveX);
      const yAxis = new THREE.Vector3()
        .setFromMatrixColumn(camera.matrix, 1)
        .multiplyScalar(moveY);
      const delta = xAxis.add(yAxis);

      camera.position.add(delta);
      controls.target.add(delta);
      controls.update();
    },
    [cameraRef, controlsRef, rendererRef]
  );

  const PAN_STEP = 64;
  const panLeft = useCallback(() => panByPixels(-PAN_STEP, 0), [panByPixels]);
  const panRight = useCallback(() => panByPixels(PAN_STEP, 0), [panByPixels]);
  const panUp = useCallback(() => panByPixels(0, -PAN_STEP), [panByPixels]);
  const panDown = useCallback(() => panByPixels(0, PAN_STEP), [panByPixels]);

  const triggerFit = useCallback(() => {
    cancelAnimationFrame(fitRafRef.current);

    const attemptFit = () => {
      const controls = controlsRef.current;
      const camera = cameraRef.current;
      const content = contentRef.current;

      if (!sceneObject || !controls || !camera || !content) {
        fitRafRef.current = requestAnimationFrame(attemptFit);
        return;
      }

      handleFit();
      if (controlsRef.current && cameraRef.current) {
        initialTarget.current.copy(controlsRef.current.target);
        initialCamPos.current.copy(cameraRef.current.position);
      }
    };

    fitRafRef.current = requestAnimationFrame(attemptFit);
  }, [cameraRef, contentRef, controlsRef, handleFit, sceneObject]);

  useEffect(() => {
    if (!sceneObject) {
      cancelAnimationFrame(fitRafRef.current);
      return undefined;
    }
    if (loadStatus === "loading" && !sceneObject.userData?.streamingReady) {
      cancelAnimationFrame(fitRafRef.current);
      return undefined;
    }
    triggerFit();
    return () => cancelAnimationFrame(fitRafRef.current);
  }, [sceneObject, loadStatus, triggerFit]);

  return {
    initialCamPos,
    initialTarget,
    handleZoomIn,
    handleZoomOut,
    handleFit,
    handleResetView,
    panLeft,
    panRight,
    panUp,
    panDown,
  };
};
