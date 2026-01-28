export const parseEmbedConfig = () => {
  if (typeof window === "undefined") {
    return {
      enabled: false,
      mode: null,
      src: null,
      origin: null,
      transparent: false,
    };
  }
  const params = new URLSearchParams(window.location.search);
  const rawEmbed = params.get("embed");
  if (!rawEmbed) {
    return {
      enabled: false,
      mode: null,
      src: null,
      origin: null,
      transparent: false,
    };
  }
  const normalized = rawEmbed === "1" || rawEmbed === "true" ? "quick" : rawEmbed;
  const src = params.get("src");
  const originParam = params.get("origin");
  let origin = null;
  if (originParam) {
    if (originParam === "*") {
      origin = "*";
    } else {
      try {
        origin = new URL(originParam, window.location.href).origin;
      } catch {
        origin = null;
      }
    }
  } else if (document.referrer) {
    try {
      origin = new URL(document.referrer).origin;
    } catch {
      origin = null;
    }
  }
  const transparentValue = params.get("transparent");
  const transparent = transparentValue === "1" || transparentValue === "true";
  return {
    enabled: true,
    mode: normalized,
    src,
    origin,
    transparent,
  };
};

export const decodeBase64ToArrayBuffer = (input) => {
  if (!input) return null;
  const base64 = input.includes(",") ? input.split(",").pop() : input;
  let binary = "";
  try {
    binary = window.atob(base64);
  } catch {
    return null;
  }
  const len = binary.length;
  const buffer = new ArrayBuffer(len);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < len; i += 1) {
    view[i] = binary.charCodeAt(i);
  }
  return buffer;
};
