import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

describe("public embed API", () => {
  it("correlates Promise commands with authenticated iframe responses", async () => {
    document.body.innerHTML = '<div id="viewer"></div>';
    window.eval(fs.readFileSync(path.resolve("public/embed.js"), "utf8"));
    const viewer = window.ThreeMFViewerEmbed.create({
      container: "#viewer",
      baseOrigin: "https://viewer.example",
      readyTimeoutMs: 1000,
    });
    const postMessage = vi.spyOn(viewer.iframe.contentWindow, "postMessage");

    window.dispatchEvent(new MessageEvent("message", {
      origin: "https://viewer.example",
      source: viewer.iframe.contentWindow,
      data: { type: "ready" },
    }));
    await viewer.ready();

    const statePromise = viewer.getState();
    await Promise.resolve();
    const [command] = postMessage.mock.calls.at(-1);
    expect(command).toMatchObject({
      type: "3mf-viewer-command",
      version: 1,
      command: "viewer.getState",
    });

    window.dispatchEvent(new MessageEvent("message", {
      origin: "https://viewer.example",
      source: viewer.iframe.contentWindow,
      data: {
        type: "3mf-viewer-result",
        version: 1,
        requestId: command.requestId,
        token: command.token,
        ok: true,
        result: { loadStatus: "ready" },
      },
    }));
    await expect(statePromise).resolves.toEqual({ loadStatus: "ready" });
    viewer.destroy();
  });
});
