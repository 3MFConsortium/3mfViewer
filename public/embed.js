(() => {
  const DEFAULT_HEIGHT = "600px";

  const getScriptTag = () => {
    const current = document.currentScript;
    if (current) return current;
    const scripts = document.getElementsByTagName("script");
    return scripts[scripts.length - 1] || null;
  };

  const getBaseOrigin = () => {
    const script = getScriptTag();
    if (!script || !script.src) return window.location.origin;
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

  const buildIframeSrc = (base, options) => {
    const url = new URL(base);
    url.searchParams.set("embed", "quick");
    if (options.src) url.searchParams.set("src", options.src);
    if (options.origin) url.searchParams.set("origin", options.origin);
    if (options.transparent) url.searchParams.set("transparent", "1");
    return url.toString();
  };

  const postToViewer = (iframe, origin, payload, transferList) => {
    if (!iframe || !iframe.contentWindow) return;
    if (transferList && transferList.length) {
      iframe.contentWindow.postMessage(payload, origin, transferList);
    } else {
      iframe.contentWindow.postMessage(payload, origin);
    }
  };

  const isTypedArray = (value) =>
    value && ArrayBuffer.isView(value) && !(value instanceof DataView);

  const toBlobPayload = (file, nameOverride) => {
    if (!file) return null;
    if (file instanceof File) {
      return { blob: file, name: nameOverride || file.name };
    }
    if (file instanceof Blob) {
      return { blob: file, name: nameOverride || "model.3mf" };
    }
    if (file instanceof ArrayBuffer) {
      return { blob: new Blob([file]), name: nameOverride || "model.3mf" };
    }
    if (isTypedArray(file)) {
      return { blob: new Blob([file.buffer]), name: nameOverride || "model.3mf" };
    }
    return null;
  };

  const create = (options = {}) => {
    const baseOrigin = options.baseOrigin || getBaseOrigin();
    const container = resolveContainer(options.container) || document.body;

    const wrapper = document.createElement("div");
    wrapper.style.position = "relative";
    wrapper.style.width = options.width || "100%";
    wrapper.style.height = options.height || DEFAULT_HEIGHT;

    const embedOrigin = options.origin || window.location.origin;
    const iframe = document.createElement("iframe");
    iframe.src = buildIframeSrc(`${baseOrigin}/`, {
      ...options,
      origin: embedOrigin,
    });
    iframe.style.border = "0";
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.allow = "fullscreen";

    wrapper.appendChild(iframe);
    container.appendChild(wrapper);

    const origin = new URL(iframe.src).origin;
    const onReady = typeof options.onReady === "function" ? options.onReady : null;
    const onRequestFile = typeof options.onRequestFile === "function" ? options.onRequestFile : null;

    const handleMessage = (event) => {
      if (event.origin !== origin) return;
      if (!event.data) return;
      if (event.data.type === "ready") {
        if (onReady) onReady(api);
        return;
      }
      if (event.data.type === "requestFile") {
        if (onRequestFile) onRequestFile(api);
      }
    };

    const api = {
      iframe,
      destroy: () => {
        window.removeEventListener("message", handleMessage);
        wrapper.remove();
      },
      load: (payload) => postToViewer(iframe, origin, { type: "load", ...payload }),
      sendFile: (file, opts = {}) => {
        const payload = toBlobPayload(file, opts.name);
        if (!payload) return;
        postToViewer(iframe, origin, { type: "load", ...payload });
      },
      loadFromUrl: (url, name) =>
        postToViewer(iframe, origin, { type: "load", url, name }),
      loadFromBase64: (data, name) =>
        postToViewer(iframe, origin, {
          type: "load",
          name,
          encoding: "base64",
          data,
        }),
      loadFromBlob: (blob, name) =>
        postToViewer(iframe, origin, { type: "load", name, blob }),
      clear: () => postToViewer(iframe, origin, { type: "clear" }),
      fitView: () => postToViewer(iframe, origin, { type: "fitView" }),
      resetView: () => postToViewer(iframe, origin, { type: "resetView" }),
    };

    window.addEventListener("message", handleMessage);

    return api;
  };

  window.ThreeMFViewerEmbed = {
    create,
  };
})();
