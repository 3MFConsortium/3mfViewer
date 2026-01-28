# 3MF Viewer

A fast, fully client‑side 3MF viewer built with React, Three.js, and the lib3mf WebAssembly runtime. It supports drag‑and‑drop viewing, a scene tree, slice stacks, beam lattices, and an embeddable “quick viewer” mode.

## Quick Start

```bash
npm install
npm run dev
```

Then open the dev server URL shown in your terminal (default: http://localhost:5173).

## Scripts

- `npm run dev` – start the Vite dev server
- `npm run build` – build a production bundle
- `npm run preview` – preview the production build locally
- `npm run test` – run tests (Vitest)
- `npm run test:ui` – run tests with UI
- `npm run lint` – run ESLint

## What this viewer does

- Load `.3mf` files via drag & drop or file picker
- Render meshes, textures, colors, properties, and metadata
- View slice stacks with a scrubber
- Visualize beam lattices (lines or hybrid)
- Toggle wireframe/edges, grid, ground, lighting, and other preferences
- Inspect scene tree data and per‑mesh details
- Embed the viewer in other pages with a lightweight API

## Embedding (Quick Viewer)

The embed mode hides most UI and focuses on the renderer + slice slider.

Example usage:

```html
<div id="viewer"></div>
<script src="/embed.js"></script>
<script>
  const viewer = ThreeMFViewerEmbed.create({
    container: "#viewer",
    height: "100%",
    src: "/data/colorcube.3mf",
    transparent: true
  });
</script>
```

Embed parameters are handled through query params like `?embed=1&src=...&transparent=1`.

## Project Structure (high level)

```
src/
  App.jsx                    # App entry (providers + bootstrap)
  app/
    ViewerApp.jsx            # Main viewer UI & orchestration
    ViewerBootstrap.jsx      # Runtime loading gate
  components/
    loaders/                 # lib3mf loader + worker integration
    scene/                   # Three.js scene helpers
    viewer/                  # Viewer UI pieces (HUD, overlays, etc.)
    ui/                      # UI primitives and controls
  contexts/                  # Theme context
  hooks/                     # Shared hooks
  stores/                    # Zustand state
  workers/                   # Web workers (lib3mf parsing)
```

## Runtime Overview

1. The WASM runtime loads (lib3mf).
2. 3MF is parsed in a web worker when possible.
3. Results are streamed into the Three.js scene.
4. Zustand drives UI + viewer preferences.

## Preferences

Preferences are applied live and include lighting, background, wireframe/edges, helpers, and UI visibility. Use “Restore defaults” in the preferences modal to reset.

## Release Notes

Release notes are stored in `src/release-notes.json` and shown in‑app.

To bump a release:
1. Update `package.json` version.
2. Add notes under the same version key in `src/release-notes.json`.

## Troubleshooting

- If the runtime fails to initialize, reload the page.
- If a 3MF does not render correctly, try toggling wireframe/edges to inspect geometry.
- For diagnostics on import errors, open the diagnostics panel in the scene tree.

---

Questions or feedback? Open an issue or PR.
