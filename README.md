# 3MF Viewer

Interactive viewer for `.3mf` models built with React, Three.js, and the lib3mf WebAssembly runtime. The app runs fully client-side and is optimised for mouse and touch workflows.

## Getting Started

```bash
npm install
npm run dev
```

- `npm run dev` – start Vite dev server (default: <http://localhost:5173>)
- `npm run build` – production bundle (Vite)
- `npm run preview` – serve the production bundle locally

## Project Structure

```
src/
  App.jsx                # Top-level viewer logic and UI composition
  components/
    loaders/ThreeMFLoader.jsx   # WASM bootstrap + 3MF parsing pipeline
    scene/SceneContent.jsx      # Renders the loaded meshes
    ui/*                        # Reusable UI widgets (controls, modals, tree)
  stores/viewerStore.js         # Zustand state (scene object, prefs, status)
  worker.js                     # Placeholder for future workers (currently unused)
  release-notes.json            # HUD release notes (synced with package version)
```

Tailwind CSS (v4) drives styling; utility classes are composed inline. Icons come from `react-icons`.

## Runtime Overview

1. `ThreeMFLoaderProvider` initialises the lib3mf WASM module on demand.
2. `ViewerBootstrap` waits for the runtime, showing a loading state if the download is slow or fails.
3. `ViewerApp` renders the layout:
   - File ingestion (drag & drop on desktop, browse CTA on touch)
   - Canvas (`@react-three/fiber`) with lighting, helpers, and mesh rendering
   - Overlay UI (scene tree, dock controls, preferences modal, release notes)
4. Zustand store (`viewerStore`) tracks load status, errors, scene object, and user preferences so UI toggles update immediately.

The loader recenters meshes around the origin and generates per-mesh metadata (IDs, counts) for the scene tree.

## Input & Gestures

- **Desktop**: mouse orbit (drag), pan (`Shift` + drag or arrow keys), scroll to zoom, toolbar/D-pad buttons for quick actions.
- **Touch**: single-finger orbit, two-finger drag to pan, pinch to zoom, double tap to fit, two-finger tap to reset. A floating dock exposes the same toolbar actions with larger hit targets.

## Key Preferences

Toggle these from the Preferences button (top-right):

- Background colour, lighting intensity/colour
- Ground plane, grid, shadow casting
- Wireframe / edges rendering styles
- Visibility of scene tree, bottom toolbar, helper tips, stats overlay

Preferences are stored in memory (no persistence yet). `Restore defaults` reverts to `DEFAULT_PREFS` in the store.

## Scene Tree & File Loading

- Desktop: persistent tree on the left; mobile/tablet: slide-in drawer via the hamburger icon.
- Files are validated for `.3mf` extension; non-conforming uploads raise a user-visible error.
- Loading state banners sit centred near the top; all drag operations collapse when the file dialog completes.

## Release Workflow

1. Update `package.json` version.
2. Add notes to `src/release-notes.json` under the matching version key (displayed in-app).
3. Run `npm run build` to ensure the bundle compiles.

## Debugging Tips

- Use the in-app stats overlay (`Preferences → Interface → Stats overlay`) for frame timing.
- Inspect the orbit controls instance through React DevTools: located in `App.jsx` via `controlsRef`.
- Enable wireframe or edge overlay to sanity-check geometry import issues.
- If lib3mf fails to load (network/WASM problems), `ViewerBootstrap` surfaces a retry banner in the UI.

---

Questions or contributions? Open an issue or PR
