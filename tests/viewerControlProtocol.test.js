import { describe, expect, it } from "vitest";
import {
  VIEWER_CONTROL_VERSION,
  VIEWER_MESSAGE_TYPES,
  createViewerEvent,
  createViewerResult,
  validateViewerCommand,
  validateViewerSession,
} from "../src/lib/viewerControlProtocol.js";

describe("viewer control protocol", () => {
  it("validates versioned commands", () => {
    expect(validateViewerCommand({
      type: VIEWER_MESSAGE_TYPES.command,
      version: VIEWER_CONTROL_VERSION,
      requestId: "request-1",
      command: "scene.getManifest",
      arguments: {},
    })).toBeNull();
    expect(validateViewerCommand({
      type: VIEWER_MESSAGE_TYPES.command,
      version: 99,
      requestId: "request-1",
      command: "scene.getManifest",
    })).toContain("version");
  });

  it("creates correlated results and authenticated events", () => {
    expect(createViewerResult({ requestId: "r1", token: "secret", result: { ok: true } }))
      .toMatchObject({ requestId: "r1", token: "secret", ok: true, result: { ok: true } });
    expect(createViewerResult({ requestId: "r2", error: { code: "bad", message: "No" } }))
      .toMatchObject({ requestId: "r2", ok: false, error: { code: "bad", message: "No" } });
    expect(createViewerEvent({ event: "renderReady", token: "secret", data: { name: "part.3mf" } }))
      .toMatchObject({ event: "renderReady", token: "secret", data: { name: "part.3mf" } });
  });

  it("requires the exact parent origin and session token", () => {
    const payload = {
      type: VIEWER_MESSAGE_TYPES.command,
      version: VIEWER_CONTROL_VERSION,
      requestId: "request-1",
      token: "secret",
      command: "viewer.getState",
    };
    expect(validateViewerSession({
      payload,
      allowedOrigin: "https://host.example",
      eventOrigin: "https://host.example",
      token: "secret",
    })).toBeNull();
    expect(validateViewerSession({
      payload,
      allowedOrigin: "*",
      eventOrigin: "https://host.example",
      token: "secret",
    })?.code).toBe("insecure_origin");
    expect(validateViewerSession({
      payload: { ...payload, token: "wrong" },
      allowedOrigin: "https://host.example",
      eventOrigin: "https://host.example",
      token: "secret",
    })?.code).toBe("invalid_token");
  });
});
