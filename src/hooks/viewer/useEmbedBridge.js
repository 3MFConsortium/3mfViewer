import { useEffect } from "react";

export const useEmbedBridge = ({
  embedConfig,
  sceneObject,
  loadFromArrayBuffer,
  clearScene,
  handleFit,
  handleResetView,
  decodeBase64ToArrayBuffer,
  embedReadyRef,
  embedSrcLoadedRef,
}) => {
  useEffect(() => {
    if (!embedConfig.enabled) return undefined;
    const allowedOrigin = embedConfig.origin;
    const allowAny = !allowedOrigin || allowedOrigin === "*";
    const targetOrigin = allowAny ? "*" : allowedOrigin;
    const isParentFrame = () => window.parent && window.parent !== window;

    const postToParent = (payload) => {
      if (!isParentFrame()) return;
      window.parent.postMessage(payload, targetOrigin);
    };

    const loadFromPayload = async (payload) => {
      if (!payload) return;
      if (payload.files && Array.isArray(payload.files) && payload.files.length) {
        const [first] = payload.files;
        await loadFromPayload({ ...first, name: first.name || payload.name });
        return;
      }
      if (payload.blob instanceof Blob) {
        const buffer = await payload.blob.arrayBuffer();
        await loadFromArrayBuffer(buffer, payload.name, { skipExtensionCheck: !payload.name });
        return;
      }
      if (payload.file instanceof File) {
        const buffer = await payload.file.arrayBuffer();
        await loadFromArrayBuffer(buffer, payload.file.name);
        return;
      }
      if (payload.arrayBuffer instanceof ArrayBuffer) {
        await loadFromArrayBuffer(payload.arrayBuffer, payload.name, {
          skipExtensionCheck: !payload.name,
        });
        return;
      }
      if (payload.encoding === "base64" && payload.data) {
        const buffer = decodeBase64ToArrayBuffer(payload.data);
        await loadFromArrayBuffer(buffer, payload.name, { skipExtensionCheck: !payload.name });
        return;
      }
      if (payload.url) {
        const response = await fetch(payload.url);
        const buffer = await response.arrayBuffer();
        const nameFromUrl = payload.name || payload.url.split("/").pop() || "embedded.3mf";
        await loadFromArrayBuffer(buffer, nameFromUrl, { skipExtensionCheck: !payload.name });
      }
    };

    const handleMessage = async (event) => {
      if (!allowAny && event.origin !== allowedOrigin) return;
      if (isParentFrame() && event.source !== window.parent) return;
      if (!event.data || typeof event.data !== "object") return;
      const payload = event.data;
      try {
        switch (payload.type) {
          case "load":
          case "append":
            await loadFromPayload(payload);
            break;
          case "clear":
            clearScene();
            break;
          case "fitView":
            handleFit();
            break;
          case "resetView":
            handleResetView();
            break;
          default:
            break;
        }
      } catch (err) {
        postToParent({
          type: "error",
          message: err?.message || "Failed to process embed command.",
        });
      }
    };

    window.addEventListener("message", handleMessage);
    if (!embedReadyRef.current) {
      postToParent({ type: "ready" });
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
    embedConfig,
    loadFromArrayBuffer,
    clearScene,
    handleFit,
    handleResetView,
    sceneObject,
    decodeBase64ToArrayBuffer,
    embedReadyRef,
  ]);

  useEffect(() => {
    if (!embedConfig.enabled || !embedConfig.src) return;
    if (embedSrcLoadedRef.current === embedConfig.src) return;
    embedSrcLoadedRef.current = embedConfig.src;
    const run = async () => {
      try {
        const response = await fetch(embedConfig.src);
        const buffer = await response.arrayBuffer();
        const nameFromUrl = embedConfig.src.split("/").pop() || "embedded.3mf";
        await loadFromArrayBuffer(buffer, nameFromUrl, { skipExtensionCheck: true });
      } catch (err) {
        console.error("Failed to load embed src", err);
      }
    };
    run();
  }, [embedConfig, loadFromArrayBuffer, embedSrcLoadedRef]);
};
