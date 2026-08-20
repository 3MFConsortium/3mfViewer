import { useCallback, useMemo } from "react";
import {
  VIEWER_CAPABILITIES,
  VIEWER_CONTROL_VERSION,
  ViewerControlError,
} from "../../lib/viewerControlProtocol.js";
import {
  buildSceneManifest,
  flattenSceneTree,
  resolveSceneTargets,
} from "../../lib/viewerSceneManifest.js";

const MAX_MODEL_BYTES = 512 * 1024 * 1024;
const RENDER_OPTION_KEYS = new Set([
  "background",
  "wireframe",
  "edges",
  "edgeColor",
  "ground",
  "grid",
  "showStats",
]);

const summarizeNode = (node) => node
  ? {
      id: node.id,
      visibilityId: node.visibilityId ?? null,
      name: node.name,
      type: node.type,
      meta: node.meta || {},
    }
  : null;

const assertPayloadSize = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    throw new ViewerControlError("invalid_model", "The model payload is empty.");
  }
  if (bytes > MAX_MODEL_BYTES) {
    throw new ViewerControlError(
      "model_too_large",
      `The model exceeds the ${MAX_MODEL_BYTES} byte viewer-control limit.`
    );
  }
};

export const useViewerController = ({
  treeItems,
  sceneData,
  sceneBounds,
  loadedName,
  loadStatus,
  renderReady,
  prefs,
  hiddenMeshIds,
  selectedNodeId,
  selectedNodeInfo,
  loadFromArrayBuffer,
  decodeBase64ToArrayBuffer,
  clearScene,
  setSelectedNode,
  setMeshVisibility,
  isolateMeshIds,
  resetVisibility,
  setPrefs,
  handleFit,
  handleResetView,
  getCameraState,
  setCameraState,
  setPresetView,
  capturePng,
}) => {
  const manifest = useMemo(
    () => buildSceneManifest({
      treeItems,
      sceneData,
      loadedName,
      bounds: sceneBounds,
      hiddenMeshIds,
      selectedNodeId,
    }),
    [treeItems, sceneData, loadedName, sceneBounds, hiddenMeshIds, selectedNodeId]
  );

  const loadModel = useCallback(async (payload = {}) => {
    let buffer;
    let name = payload.name || "model.3mf";
    if (payload.file instanceof File) {
      name = payload.name || payload.file.name;
      assertPayloadSize(payload.file.size);
      buffer = await payload.file.arrayBuffer();
    } else if (payload.blob instanceof Blob) {
      assertPayloadSize(payload.blob.size);
      buffer = await payload.blob.arrayBuffer();
    } else if (payload.arrayBuffer instanceof ArrayBuffer) {
      assertPayloadSize(payload.arrayBuffer.byteLength);
      buffer = payload.arrayBuffer;
    } else if (payload.encoding === "base64" && typeof payload.data === "string") {
      const estimatedBytes = Math.floor(payload.data.length * 0.75);
      assertPayloadSize(estimatedBytes);
      buffer = decodeBase64ToArrayBuffer(payload.data);
    } else {
      throw new ViewerControlError(
        "invalid_model",
        "model.load requires a File, Blob, ArrayBuffer, or base64 payload."
      );
    }
    if (!(buffer instanceof ArrayBuffer)) {
      throw new ViewerControlError("invalid_model", "The model payload could not be decoded.");
    }
    assertPayloadSize(buffer.byteLength);
    await loadFromArrayBuffer(buffer, name, { skipExtensionCheck: !payload.name });
    return { name, bytes: buffer.byteLength };
  }, [decodeBase64ToArrayBuffer, loadFromArrayBuffer]);

  const resolveTargets = useCallback((target) => {
    const matches = resolveSceneTargets(treeItems, target);
    if (!matches.length) {
      throw new ViewerControlError("target_not_found", "No scene object matched the target.");
    }
    return matches;
  }, [treeItems]);

  const execute = useCallback(async (command, args = {}) => {
    switch (command) {
      case "viewer.getCapabilities":
        return {
          protocolVersion: VIEWER_CONTROL_VERSION,
          commands: [...VIEWER_CAPABILITIES],
          cameraPresets: ["front", "back", "left", "right", "top", "bottom", "isometric"],
          maxModelBytes: MAX_MODEL_BYTES,
        };
      case "viewer.getState":
        return {
          loadStatus,
          renderReady,
          loadedName: loadedName || null,
          selected: selectedNodeInfo,
          hiddenMeshIds,
          prefs,
          camera: getCameraState(),
        };
      case "model.load":
        return loadModel(args);
      case "model.clear":
        clearScene();
        return { cleared: true };
      case "scene.getManifest":
        return manifest;
      case "scene.select": {
        if (args.target == null) {
          setSelectedNode(null);
          return { selected: null };
        }
        const [node] = resolveTargets(args.target);
        const selected = summarizeNode(node);
        setSelectedNode(selected);
        return { selected };
      }
      case "scene.setVisibility": {
        if (typeof args.visible !== "boolean") {
          throw new ViewerControlError("invalid_arguments", "visible must be a boolean.");
        }
        const matches = resolveTargets(args.target);
        const ids = matches.map((node) => node.visibilityId).filter(Boolean);
        ids.forEach((id) => setMeshVisibility(id, args.visible));
        return { visibilityIds: ids, visible: args.visible };
      }
      case "scene.isolate": {
        const matches = resolveTargets(args.target);
        const visibleIds = matches.map((node) => node.visibilityId).filter(Boolean);
        const allIds = flattenSceneTree(treeItems)
          .filter((node) => node.type === "mesh")
          .map((node) => node.visibilityId)
          .filter(Boolean);
        isolateMeshIds(allIds, visibleIds);
        return { visibilityIds: visibleIds };
      }
      case "scene.resetVisibility":
        resetVisibility();
        return { reset: true };
      case "camera.fit": {
        const ids = args.target
          ? resolveTargets(args.target).map((node) => node.visibilityId).filter(Boolean)
          : [];
        if (!handleFit(ids)) {
          throw new ViewerControlError("camera_unavailable", "The requested scene bounds are unavailable.");
        }
        return getCameraState();
      }
      case "camera.reset":
        handleResetView();
        return getCameraState();
      case "camera.get":
        return getCameraState();
      case "camera.set":
        if (!setCameraState(args)) {
          throw new ViewerControlError("camera_unavailable", "The camera is not ready.");
        }
        return getCameraState();
      case "camera.setPreset": {
        const ids = args.target
          ? resolveTargets(args.target).map((node) => node.visibilityId).filter(Boolean)
          : [];
        if (!setPresetView(args.preset, ids)) {
          throw new ViewerControlError("invalid_preset", `Unsupported or unavailable preset: ${String(args.preset)}.`);
        }
        return getCameraState();
      }
      case "render.setOptions": {
        const options = args.options && typeof args.options === "object" ? args.options : args;
        const requested = Object.fromEntries(
          Object.entries(options).filter(([key]) => RENDER_OPTION_KEYS.has(key))
        );
        setPrefs((current) => ({ ...current, ...requested }));
        return { options: requested };
      }
      case "slice.setIndex": {
        const index = Number(args.index);
        if (!Number.isInteger(index) || index < -1) {
          throw new ViewerControlError("invalid_arguments", "Slice index must be an integer of -1 or greater.");
        }
        setPrefs((current) => ({ ...current, sliceIndex: index }));
        return { index };
      }
      case "beamLattice.setMode":
        if (args.mode !== "solid" && args.mode !== "centerlines") {
          throw new ViewerControlError("invalid_arguments", "Beam-lattice mode must be solid or centerlines.");
        }
        setPrefs((current) => ({ ...current, beamLatticeMode: args.mode }));
        return { mode: args.mode };
      case "capture.png":
        return capturePng(args);
      default:
        throw new ViewerControlError("unsupported_command", `Unsupported viewer command: ${command}.`);
    }
  }, [
    capturePng,
    clearScene,
    getCameraState,
    handleFit,
    handleResetView,
    hiddenMeshIds,
    isolateMeshIds,
    loadModel,
    loadedName,
    loadStatus,
    manifest,
    prefs,
    renderReady,
    resetVisibility,
    resolveTargets,
    selectedNodeInfo,
    setCameraState,
    setMeshVisibility,
    setPrefs,
    setPresetView,
    setSelectedNode,
    treeItems,
  ]);

  return { execute, manifest };
};
