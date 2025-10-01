# Architecture Guide

This document captures the moving parts of the 3MF viewer so you can reason about bugs and extend features without diving through components blindly.

## High-Level Flow

1. **Bootstrap**
   - `main.jsx` mounts `<App />`.
   - `<App />` wraps the entire viewer with `ThreeMFLoaderProvider`, exposing loader helpers through context.
   - `ViewerBootstrap` awaits the lib3mf WASM runtime: you either see a loading spinner, an error banner with retry, or the fully initialised `<ViewerApp />`.

2. **ViewerApp Responsibilities**
   - Manage global Zustand store (`viewerStore`): scene object, metadata, UI prefs, load status/errors.
   - Wire up drag-and-drop + file dialog ingestion (`handleLoadFile`).
   - Configure camera/orbit control helpers, panning logic, fit/reset operations.
   - Render responsive overlays (scene tree, HUD buttons, helper messages, release notes).
   - Drive gesture affordances for coarse pointers (touch detection, double-tap fit, two-finger reset, mobile dock).

3. **Rendering Pipeline**
   - `ThreeMFLoaderProvider` wraps lib3mf and provides `load3mf(arrayBuffer, name)`.
   - The loader writes the incoming file into the lib3mf virtual filesystem, iterates mesh objects, constructs `THREE.Mesh` instances, and recenters the group at origin.
   - `SceneContent` takes the resulting `group` and renders it inside `<Canvas />`, optionally overlaying wireframe/edges based on preferences.

4. **UI Composition**
   - Tailwind utility classes handle layout and theming.
   - Floating widgets (toolbar/dock, tips, stats, release notes) respect pointer type to avoid clutter on touch screens.
   - `SceneTree` doubles as both a desktop sidebar and a mobile drawer via the `variant="drawer"` prop.

## Key Modules

| Location | Purpose |
| --- | --- |
| `src/stores/viewerStore.js` | Zustand store; central source of truth for scene data and UI preferences. |
| `src/components/loaders/ThreeMFLoader.jsx` | Encapsulates lib3mf initialisation and parsing; returns meshes + metadata. |
| `src/components/scene/SceneContent.jsx` | Handles actual Three.js rendering of the loaded mesh group. |
| `src/components/ui/BottomControls.jsx` | Toolbar buttons (zoom, fit, toggles). Also used for touch dock with an optional `endCap`. |
| `src/components/ui/SceneTree.jsx` | Displays object hierarchy and provides a “Load 3MF” CTA. Has desktop panel + mobile drawer modes. |
| `src/components/ui/Modal.jsx` | Generic modal with keyboard-close binding (used for preferences/release notes). |
| `src/App.jsx` | Brains of the viewer—layout, responses to pointer type, gesture registration, and UI wiring. |

## State & Side Effects

- `viewerStore`
  - `loadStatus`: `idle` → `loading` → `ready`/`error`
  - `prefs`: toggled via UI controls; resetting clones `DEFAULT_PREFS`.
  - `sceneObject`: Three.js group used by `SceneContent` and for bounding-box calculations.
- React refs (`controlsRef`, `cameraRef`, `rendererRef`) hold references to three.js objects without causing rerenders.
- `useEffect` hooks in `App.jsx`
  - Drag-and-drop listeners
  - Pointer-type detection via `matchMedia('(pointer: coarse)')`
  - Gesture listeners attached to the canvas (double tap fit, two-finger reset)
  - Mobile dock overlay state + hint animations

## Adding Features

- **New UI Toggle**
  1. Add default flag to `DEFAULT_PREFS` in the store.
  2. Expose controls in `ScenePreferences` (and optionally in `BottomControls`).
  3. Use the flag in `App.jsx` or child component to hide/show behaviour.

- **Alternative Render Modes**
  - Add uniforms/materials in `SceneContent` and toggle via prefs, similar to the existing wireframe/edges logic.

- **Different Input Gestures**
  - Extend the touch handler section in `App.jsx`; always wrap new listeners in `useEffect` cleanup blocks to avoid leaks.

- **Loading Other Formats**
  - Introduce new provider/loader alongside `ThreeMFLoaderProvider` or expand it with conditional parsing; remember to update validation and error copy.

## Troubleshooting

- **Blank Canvas**: usually means `sceneObject` is null (load failed) or fit hasn’t run—check `loadStatus` and console errors.
- **Runtime Errors**: WASM initialisation problems surface in `ViewerBootstrap`; confirm network access to the lib3mf bundle.
- **Controls Overlap**: touch vs desktop breakpoints determined by `isCoarsePointer` and `viewportWidth`; tweak `coarseTabletBreakpoint` in `App.jsx` if layouts feel cramped.
- **Mesh Off-Centre**: loader recentres meshes; if you see offset content, inspect the bounding box logic in `ThreeMFLoader.jsx` or verify the input file.

## Release Checklist

1. `npm version` bump or manual `package.json` edit.
2. Update `src/release-notes.json` with bullet points (appears in HUD release notes modal).
3. `npm run build` – ensures the Vite bundle compiles.
4. Commit + tag (if desired) and deploy (`npm run deploy` for Cloudflare Workers).

Keeping this flow in mind should make future bug-fixes or feature work far less mysterious.
