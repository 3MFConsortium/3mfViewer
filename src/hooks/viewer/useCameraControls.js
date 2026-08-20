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

  const fitBox = useCallback((box, requestedDirection = null) => {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!controls || !camera || !box) return false;
    if (box.isEmpty()) return;

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = size.length() / 2;
    const distance = calculateFitDistance(size, camera.fov, camera.aspect);
    if (!distance) return;
    const direction = requestedDirection
      ? requestedDirection.clone()
      : new THREE.Vector3().subVectors(camera.position, controls.target);
    if (direction.lengthSq() < Number.EPSILON) direction.set(1, 0.8, 1);
    direction.normalize();

    controls.target.copy(center);
    camera.position.copy(center).addScaledVector(direction, distance);
    camera.near = Math.max(0.001, (distance - radius) / 100);
    camera.far = Math.max(1000, (distance + radius) * 10);
    camera.updateProjectionMatrix();
    controls.update();
    return true;
  }, [cameraRef, controlsRef]);

  const getTargetBox = useCallback((visibilityIds = []) => {
    const content = contentRef.current;
    if (!content) return null;
    const requested = new Set((visibilityIds || []).map(String));
    if (requested.size === 0) return new THREE.Box3().setFromObject(content);
    const box = new THREE.Box3();
    let matched = false;
    content.traverse((child) => {
      if (!child.isMesh && !child.isLineSegments) return;
      if (!requested.has(String(child.userData?.visibilityId))) return;
      box.union(new THREE.Box3().setFromObject(child));
      matched = true;
    });
    return matched ? box : null;
  }, [contentRef]);

  const handleFit = useCallback((visibilityIds = []) => {
    const box = getTargetBox(Array.isArray(visibilityIds) ? visibilityIds : []);
    return fitBox(box);
  }, [fitBox, getTargetBox]);

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

  const getCameraState = useCallback(() => {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!controls || !camera) return null;
    return {
      position: camera.position.toArray(),
      target: controls.target.toArray(),
      up: camera.up.toArray(),
      fov: camera.fov,
      near: camera.near,
      far: camera.far,
    };
  }, [cameraRef, controlsRef]);

  const setCameraState = useCallback((state = {}) => {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!controls || !camera) return false;
    const setVector = (target, value) => {
      if (!Array.isArray(value) || value.length !== 3) return;
      const numbers = value.map(Number);
      if (numbers.every(Number.isFinite)) target.fromArray(numbers);
    };
    setVector(camera.position, state.position);
    setVector(controls.target, state.target);
    setVector(camera.up, state.up);
    if (Number.isFinite(Number(state.fov))) camera.fov = Math.min(150, Math.max(1, Number(state.fov)));
    if (Number.isFinite(Number(state.near))) camera.near = Math.max(0.0001, Number(state.near));
    if (Number.isFinite(Number(state.far))) camera.far = Math.max(camera.near + 1, Number(state.far));
    camera.far = Math.max(camera.near + 1, camera.far);
    camera.updateProjectionMatrix();
    controls.update();
    return true;
  }, [cameraRef, controlsRef]);

  const setPresetView = useCallback((preset, visibilityIds = []) => {
    const directions = {
      front: new THREE.Vector3(0, 0, 1),
      back: new THREE.Vector3(0, 0, -1),
      left: new THREE.Vector3(-1, 0, 0),
      right: new THREE.Vector3(1, 0, 0),
      top: new THREE.Vector3(0, 1, 0),
      bottom: new THREE.Vector3(0, -1, 0),
      isometric: new THREE.Vector3(1, 1, 1),
    };
    const direction = directions[preset];
    if (!direction) return false;
    const camera = cameraRef.current;
    if (camera) {
      camera.up.set(0, 1, 0);
      if (preset === "top") camera.up.set(0, 0, -1);
      if (preset === "bottom") camera.up.set(0, 0, 1);
    }
    return fitBox(getTargetBox(visibilityIds), direction);
  }, [cameraRef, fitBox, getTargetBox]);

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
    getCameraState,
    setCameraState,
    setPresetView,
    panLeft,
    panRight,
    panUp,
    panDown,
  };
};
