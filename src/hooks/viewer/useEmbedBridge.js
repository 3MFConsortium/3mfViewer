import { useCallback, useEffect, useRef } from "react";
import {
  VIEWER_MESSAGE_TYPES,
  createViewerEvent,
  createViewerResult,
  validateViewerSession,
} from "../../lib/viewerControlProtocol.js";

export const useEmbedBridge = ({
  embedConfig,
  sceneObject,
  loadStatus,
  renderReady,
  loadedName,
  loadProgress,
  loadStage,
  selectedNodeInfo,
  prefs,
  controller,
  controlsRef,
  getCameraState,
  embedReadyRef,
  embedSrcLoadedRef,
}) => {
  const lastStateEventRef = useRef(null);
  const allowedOrigin = embedConfig.origin;
  const allowAny = !allowedOrigin || allowedOrigin === "*";
  const targetOrigin = allowAny ? "*" : allowedOrigin;
  const token = embedConfig.token;

  const postToParent = useCallback((payload, explicitOrigin = targetOrigin) => {
    if (!window.parent || window.parent === window) return;
    window.parent.postMessage(payload, explicitOrigin);
  }, [targetOrigin]);

  const postEvent = useCallback((event, data) => {
    postToParent(createViewerEvent({ event, token, data }));
  }, [postToParent, token]);

  useEffect(() => {
    if (!embedConfig.enabled) return undefined;

    const handleLegacyCommand = async (payload) => {
      switch (payload.type) {
        case "load":
        case "append":
          return controller.execute("model.load", payload);
        case "clear":
          return controller.execute("model.clear");
        case "fitView":
          return controller.execute("camera.fit");
        case "resetView":
          return controller.execute("camera.reset");
        default:
          return undefined;
      }
    };

    const handleMessage = async (event) => {
      if (!allowAny && event.origin !== allowedOrigin) return;
      if (window.parent && window.parent !== window && event.source !== window.parent) return;
      const payload = event.data;
      if (!payload || typeof payload !== "object") return;

      if (payload.type !== VIEWER_MESSAGE_TYPES.command) {
        try {
          await handleLegacyCommand(payload);
        } catch (error) {
          postToParent({ type: "error", message: error?.message || "Failed to process embed command." }, event.origin);
        }
        return;
      }

      const error = validateViewerSession({
        payload,
        allowedOrigin,
        eventOrigin: event.origin,
        token,
      });

      try {
        if (error) throw error;
        const result = await controller.execute(payload.command, payload.arguments || {});
        postToParent(createViewerResult({ requestId: payload.requestId, token, result }), event.origin);
      } catch (commandError) {
        postToParent(
          createViewerResult({ requestId: payload.requestId, token, error: commandError }),
          event.origin
        );
      }
    };

    window.addEventListener("message", handleMessage);
    if (!embedReadyRef.current) {
      postToParent({ type: "ready" });
      postEvent("ready", { secureControl: !allowAny && !!token });
      embedReadyRef.current = true;
    }
    const requestTimer = window.setTimeout(() => {
      if (!sceneObject) postToParent({ type: "requestFile" });
    }, 100);

    return () => {
      window.clearTimeout(requestTimer);
      window.removeEventListener("message", handleMessage);
    };
  }, [
    allowAny,
    allowedOrigin,
    controller,
    embedConfig.enabled,
    embedReadyRef,
    postEvent,
    postToParent,
    sceneObject,
    token,
  ]);

  useEffect(() => {
    if (!embedConfig.enabled) return;
    const previous = lastStateEventRef.current;
    const snapshot = { loadStatus, renderReady, loadedName };
    if (
      previous &&
      previous.loadStatus === loadStatus &&
      previous.renderReady === renderReady &&
      previous.loadedName === loadedName
    ) return;
    lastStateEventRef.current = snapshot;
    postEvent("stateChanged", { loadStatus, renderReady, loadedName: loadedName || null });
    if (loadStatus === "ready" && previous?.loadStatus !== "ready") {
      postEvent("loaded", { name: loadedName || null });
    }
    if (renderReady && !previous?.renderReady) {
      postEvent("renderReady", { name: loadedName || null });
    }
  }, [embedConfig.enabled, loadStatus, loadedName, postEvent, renderReady]);

  useEffect(() => {
    if (!embedConfig.enabled || loadStatus !== "loading") return undefined;
    const notify = () => postEvent("loadProgress", {
      name: loadedName || null,
      stage: loadStage?.stage || null,
      detail: loadStage?.detail || null,
      triangles: loadProgress?.triangles ?? null,
      totalTriangles: loadProgress?.totalTriangles ?? null,
      resourceIndex: loadProgress?.resourceIndex ?? null,
      resourceTotal: loadProgress?.resourceTotal ?? null,
      currentResourceName: loadProgress?.currentResourceName ?? null,
      heartbeatAt: new Date().toISOString(),
    });
    notify();
    const timer = window.setInterval(notify, 2000);
    return () => window.clearInterval(timer);
  }, [embedConfig.enabled, loadProgress, loadStage, loadStatus, loadedName, postEvent]);

  useEffect(() => {
    if (!embedConfig.enabled) return;
    postEvent("selectionChanged", { selected: selectedNodeInfo || null });
  }, [embedConfig.enabled, postEvent, selectedNodeInfo]);

  useEffect(() => {
    if (!embedConfig.enabled) return;
    postEvent("renderOptionsChanged", { prefs });
  }, [embedConfig.enabled, postEvent, prefs]);

  useEffect(() => {
    if (!embedConfig.enabled) return undefined;
    let frame = 0;
    const notifyCamera = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => postEvent("cameraChanged", getCameraState()));
    };
    const controls = controlsRef.current;
    controls?.addEventListener?.("change", notifyCamera);
    return () => {
      cancelAnimationFrame(frame);
      controls?.removeEventListener?.("change", notifyCamera);
    };
  }, [controlsRef, embedConfig.enabled, getCameraState, postEvent, sceneObject]);

  useEffect(() => {
    if (!embedConfig.enabled || !embedConfig.src) return;
    if (embedSrcLoadedRef.current === embedConfig.src) return;
    embedSrcLoadedRef.current = embedConfig.src;
    const run = async () => {
      try {
        const response = await fetch(embedConfig.src);
        if (!response.ok) throw new Error(`Failed to fetch 3MF (${response.status}).`);
        const blob = await response.blob();
        const name = embedConfig.src.split("/").pop() || "embedded.3mf";
        await controller.execute("model.load", { blob, name });
      } catch (error) {
        postEvent("error", { message: error?.message || "Failed to load embed source." });
      }
    };
    run();
  }, [controller, embedConfig, embedSrcLoadedRef, postEvent]);
};
