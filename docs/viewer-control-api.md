# Viewer Control API

`public/embed.js` exposes an authenticated, Promise-based API for controlling a 3MF viewer iframe. It is suitable for application integrations and MCP-driven visualization.

## Create a viewer

```html
<div id="viewer"></div>
<script src="https://viewer.example/embed.js"></script>
<script>
  const viewer = ThreeMFViewerEmbed.create({
    container: "#viewer",
    baseOrigin: "https://viewer.example",
    width: "100%",
    height: "700px",
    transparent: false,
  });

  await viewer.ready();
  await viewer.sendFile(file);
</script>
```

Each viewer instance generates a random session token. The token is placed in the iframe URL fragment and included in every command, response, and event. Messages are accepted only from the configured parent origin and parent window.

## Scene targets

Commands accept a target object containing one or more exact identifiers:

```js
{ modelResourceId: 12 }
{ visibilityId: "instance:item-0-2" }
{ instanceId: 3 }
{ nodeId: "mesh-7-item-0-2" }
{ uuid: "..." }
```

`modelResourceId` is the canonical ID from the 3MF package. `internalResourceId` is also reported for diagnostics but is not intended as the public cross-application identifier. A model-resource target can match multiple visible instances.

## API methods

```js
await viewer.getCapabilities();
await viewer.getState();
await viewer.getSceneManifest();

await viewer.sendFile(fileOrBlobOrArrayBuffer, { name: "part.3mf" });
await viewer.loadFromUrl(url, "part.3mf");
await viewer.loadFromBase64(data, "part.3mf");
await viewer.clear();

await viewer.select(target);
await viewer.clearSelection();
await viewer.setVisibility(target, false);
await viewer.isolate(target);
await viewer.resetVisibility();

await viewer.fitView(target);              // target is optional
await viewer.resetView();
await viewer.getCamera();
await viewer.setCamera({
  position: [10, 8, 10],
  target: [0, 0, 0],
  up: [0, 1, 0],
  fov: 50,
});
await viewer.setPresetView("top", target); // target is optional

await viewer.setRenderOptions({ wireframe: true, grid: true });
await viewer.setSliceIndex(4);             // -1 disables the slice view
await viewer.setBeamLatticeMode("centerlines");

const { blob, width, height, mimeType } = await viewer.capturePng({
  width: 1200,
  height: 900,
});
```

Camera presets are `front`, `back`, `left`, `right`, `top`, `bottom`, and `isometric`. Beam-lattice modes are `solid` and `centerlines`.

The compact scene manifest contains model metadata, resource summaries, and independently addressable instances. It deliberately excludes vertex, texture-coordinate, and image buffers.

## Events

```js
const unsubscribe = viewer.on("renderReady", ({ name }) => {
  console.log(`${name} is visible`);
});

viewer.on("loaded", handler);
viewer.on("stateChanged", handler);
viewer.on("selectionChanged", handler);
viewer.on("cameraChanged", handler);
viewer.on("renderOptionsChanged", handler);
viewer.on("error", handler);

unsubscribe();
```

Constructor callbacks such as `onReady`, `onRequestFile`, `onRenderReady`, and `onError` are also supported.

## Wire protocol

Applications normally use `embed.js`, but the protocol is intentionally small and versioned.

```js
{
  type: "3mf-viewer-command",
  version: 1,
  requestId: "request-1",
  token: "session-token",
  command: "camera.setPreset",
  arguments: { preset: "isometric" }
}
```

The viewer responds with `3mf-viewer-result` and the same `requestId`. Failures contain a stable error `code` and human-readable `message`. Unsolicited state notifications use `3mf-viewer-event`.

## Limits and security

- Controlled sessions require an exact parent origin; `*` is rejected for versioned commands.
- Model payloads are limited to 512 MiB.
- PNG dimensions are limited to 4096 pixels per side and 16,777,216 total pixels.
- The viewer does not fetch command-provided URLs. `loadFromUrl` fetches in the parent page and sends a Blob.
- Commands time out after 30 seconds by default; model loading defaults to 120 seconds. Both can be configured when creating the embed.
