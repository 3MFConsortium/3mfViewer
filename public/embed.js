(() => {
  const DEFAULT_HEIGHT = "600px";
  const PROTOCOL_VERSION = 1;
  const COMMAND_TYPE = "3mf-viewer-command";
  const RESULT_TYPE = "3mf-viewer-result";
  const EVENT_TYPE = "3mf-viewer-event";

  const getScriptTag = () => {
    if (document.currentScript) return document.currentScript;
    const scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1] || null;
  };

  const getBaseOrigin = () => {
    const script = getScriptTag();
    if (!script?.src) return window.location.origin;
    try {
      return new URL(script.src, window.location.href).origin;
    } catch {
      return window.location.origin;
    }
  };

  const resolveContainer = (container) => {
    if (!container) return null;
    if (typeof container === "string") return document.querySelector(container);
    return container instanceof HTMLElement ? container : null;
  };

  const createToken = () => {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  };

  const buildIframeSrc = (base, options, token) => {
    const url = new URL(base);
    url.searchParams.set("embed", "quick");
    url.searchParams.set("origin", options.origin || window.location.origin);
    if (options.transparent) url.searchParams.set("transparent", "1");
    const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
    hash.set("viewerToken", token);
    url.hash = hash.toString();
    return url.toString();
  };

  const isTypedArray = (value) =>
    value && ArrayBuffer.isView(value) && !(value instanceof DataView);

  const normalizeModelPayload = (file, nameOverride) => {
    if (file instanceof File) return { file, name: nameOverride || file.name };
    if (file instanceof Blob) return { blob: file, name: nameOverride || "model.3mf" };
    if (file instanceof ArrayBuffer) return { arrayBuffer: file, name: nameOverride || "model.3mf" };
    if (isTypedArray(file)) {
      return {
        arrayBuffer: file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength),
        name: nameOverride || "model.3mf",
      };
    }
    return null;
  };

  const create = (options = {}) => {
    const baseOrigin = options.baseOrigin || getBaseOrigin();
    const container = resolveContainer(options.container) || document.body;
    const token = createToken();
    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";
    wrapper.style.width = options.width || "100%";
    wrapper.style.height = options.height || DEFAULT_HEIGHT;

    const iframe = document.createElement("iframe");
    iframe.src = buildIframeSrc(`${baseOrigin}/`, options, token);
    iframe.style.border = "0";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.allow = "fullscreen";
    wrapper.appendChild(iframe);
    container.appendChild(wrapper);

    const origin = new URL(iframe.src).origin;
    const pending = new Map();
    const listeners = new Map();
    let requestCounter = 0;
    let destroyed = false;
    let ready = false;
    let resolveReady;
    let rejectReady;
    const readyPromise = new Promise((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    const readyTimeout = window.setTimeout(
      () => rejectReady(new Error("Timed out waiting for the 3MF viewer.")),
      options.readyTimeoutMs || 30_000
    );

    const emit = (event, data) => {
      (listeners.get(event) || new Set()).forEach((listener) => listener(data, api));
      const optionHandler = options[`on${event.charAt(0).toUpperCase()}${event.slice(1)}`];
      if (typeof optionHandler === "function") optionHandler(data, api);
    };

    const post = (payload) => {
      if (destroyed) throw new Error("The 3MF viewer embed has been destroyed.");
      if (!iframe.contentWindow) throw new Error("The 3MF viewer frame is unavailable.");
      iframe.contentWindow.postMessage(payload, origin);
    };

    const request = async (command, argumentsValue = {}, requestOptions = {}) => {
      await readyPromise;
      const requestId = `viewer-${Date.now()}-${++requestCounter}`;
      const timeoutMs = requestOptions.timeoutMs || options.commandTimeoutMs || 30_000;
      return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => {
          pending.delete(requestId);
          reject(new Error(`Viewer command timed out: ${command}.`));
        }, timeoutMs);
        pending.set(requestId, { resolve, reject, timer });
        try {
          post({
            type: COMMAND_TYPE,
            version: PROTOCOL_VERSION,
            requestId,
            token,
            command,
            arguments: argumentsValue,
          });
        } catch (error) {
          window.clearTimeout(timer);
          pending.delete(requestId);
          reject(error);
        }
      });
    };

    const handleMessage = (event) => {
      if (event.origin !== origin || event.source !== iframe.contentWindow) return;
      const message = event.data;
      if (!message || typeof message !== "object") return;
      if (message.type === "ready") {
        if (!ready) {
          ready = true;
          window.clearTimeout(readyTimeout);
          resolveReady(api);
          if (typeof options.onReady === "function") options.onReady(api);
          if (options.src) {
            api.loadFromUrl(options.src, options.name).catch((error) => emit("error", {
              code: error.code || "load_failed",
              message: error.message,
            }));
          }
        }
        return;
      }
      if (message.type === "requestFile") {
        if (typeof options.onRequestFile === "function") options.onRequestFile(api);
        return;
      }
      if (message.token !== token) return;
      if (message.type === RESULT_TYPE) {
        const entry = pending.get(message.requestId);
        if (!entry) return;
        pending.delete(message.requestId);
        window.clearTimeout(entry.timer);
        if (message.ok) entry.resolve(message.result);
        else {
          const error = new Error(message.error?.message || "Viewer command failed.");
          error.code = message.error?.code || "command_failed";
          entry.reject(error);
        }
        return;
      }
      if (message.type === EVENT_TYPE) emit(message.event, message.data);
    };

    const api = {
      iframe,
      ready: () => readyPromise,
      request,
      on: (event, listener) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event).add(listener);
        return () => listeners.get(event)?.delete(listener);
      },
      off: (event, listener) => listeners.get(event)?.delete(listener),
      destroy: () => {
        if (destroyed) return;
        destroyed = true;
        window.clearTimeout(readyTimeout);
        rejectReady(new Error("The 3MF viewer embed was destroyed."));
        pending.forEach(({ reject, timer }) => {
          window.clearTimeout(timer);
          reject(new Error("The 3MF viewer embed was destroyed."));
        });
        pending.clear();
        listeners.clear();
        window.removeEventListener("message", handleMessage);
        wrapper.remove();
      },
      getCapabilities: () => request("viewer.getCapabilities"),
      getState: () => request("viewer.getState"),
      getSceneManifest: () => request("scene.getManifest"),
      load: (payload) => {
        if (payload?.url) return api.loadFromUrl(payload.url, payload.name);
        return request("model.load", payload, { timeoutMs: options.loadTimeoutMs || 120_000 });
      },
      sendFile: (file, loadOptions = {}) => {
        const payload = normalizeModelPayload(file, loadOptions.name);
        if (!payload) return Promise.reject(new TypeError("Unsupported 3MF file payload."));
        return api.load(payload);
      },
      loadFromUrl: async (url, name) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch 3MF (${response.status}).`);
        return api.load({ blob: await response.blob(), name: name || url.split("/").pop() || "model.3mf" });
      },
      loadFromBase64: (data, name) => api.load({ encoding: "base64", data, name }),
      loadFromBlob: (blob, name) => api.sendFile(blob, { name }),
      clear: () => request("model.clear"),
      select: (target) => request("scene.select", { target }),
      clearSelection: () => request("scene.select", { target: null }),
      setVisibility: (target, visible) => request("scene.setVisibility", { target, visible }),
      isolate: (target) => request("scene.isolate", { target }),
      resetVisibility: () => request("scene.resetVisibility"),
      fitView: (target) => request("camera.fit", target ? { target } : {}),
      resetView: () => request("camera.reset"),
      getCamera: () => request("camera.get"),
      setCamera: (state) => request("camera.set", state),
      setPresetView: (preset, target) =>
        request("camera.setPreset", target ? { preset, target } : { preset }),
      setRenderOptions: (renderOptions) => request("render.setOptions", { options: renderOptions }),
      setSliceIndex: (index) => request("slice.setIndex", { index }),
      setBeamLatticeMode: (mode) => request("beamLattice.setMode", { mode }),
      capturePng: (captureOptions = {}) => request("capture.png", captureOptions),
    };

    window.addEventListener("message", handleMessage);
    return api;
  };

  window.ThreeMFViewerEmbed = { create, protocolVersion: PROTOCOL_VERSION };
})();
