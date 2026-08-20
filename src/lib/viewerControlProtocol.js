export const VIEWER_CONTROL_VERSION = 1;

export const VIEWER_MESSAGE_TYPES = Object.freeze({
  command: "3mf-viewer-command",
  result: "3mf-viewer-result",
  event: "3mf-viewer-event",
});

export const VIEWER_CAPABILITIES = Object.freeze([
  "viewer.getCapabilities",
  "viewer.getState",
  "model.load",
  "model.clear",
  "scene.getManifest",
  "scene.select",
  "scene.setVisibility",
  "scene.isolate",
  "scene.resetVisibility",
  "camera.fit",
  "camera.reset",
  "camera.get",
  "camera.set",
  "camera.setPreset",
  "render.setOptions",
  "slice.setIndex",
  "beamLattice.setMode",
  "capture.png",
]);

export const createViewerResult = ({ requestId, token, result, error }) => ({
  type: VIEWER_MESSAGE_TYPES.result,
  version: VIEWER_CONTROL_VERSION,
  requestId,
  ...(token ? { token } : {}),
  ok: !error,
  ...(error
    ? { error: { code: error.code || "command_failed", message: error.message || String(error) } }
    : { result: result ?? null }),
});

export const createViewerEvent = ({ event, token, data }) => ({
  type: VIEWER_MESSAGE_TYPES.event,
  version: VIEWER_CONTROL_VERSION,
  event,
  ...(token ? { token } : {}),
  data: data ?? null,
});

export const validateViewerCommand = (payload) => {
  if (!payload || typeof payload !== "object") return "Command payload must be an object.";
  if (payload.type !== VIEWER_MESSAGE_TYPES.command) return "Unsupported message type.";
  if (payload.version !== VIEWER_CONTROL_VERSION) {
    return `Unsupported protocol version: ${String(payload.version)}.`;
  }
  if (typeof payload.requestId !== "string" || !payload.requestId.trim()) {
    return "requestId must be a non-empty string.";
  }
  if (!VIEWER_CAPABILITIES.includes(payload.command)) {
    return `Unsupported viewer command: ${String(payload.command)}.`;
  }
  if (payload.arguments !== undefined && (!payload.arguments || typeof payload.arguments !== "object")) {
    return "arguments must be an object when provided.";
  }
  return null;
};

export class ViewerControlError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ViewerControlError";
    this.code = code;
  }
}

export const validateViewerSession = ({ payload, allowedOrigin, eventOrigin, token }) => {
  if (!allowedOrigin || allowedOrigin === "*" || eventOrigin !== allowedOrigin) {
    return new ViewerControlError(
      "insecure_origin",
      "Viewer-control commands require the configured exact parent origin."
    );
  }
  if (!token || payload?.token !== token) {
    return new ViewerControlError("invalid_token", "The viewer session token is missing or invalid.");
  }
  const validationError = validateViewerCommand(payload);
  return validationError
    ? new ViewerControlError("invalid_command", validationError)
    : null;
};
