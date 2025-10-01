import { create } from "zustand";

export const DEFAULT_PREFS = {
  background: "#f8fafc",
  ambient: 0.6,
  directional: 1.2,
  dirColor: "#ffffff",
  shadows: false,
  ground: true,
  grid: false,
  showStats: true,
  wireframe: false,
  edges: true,
  edgeColor: "#111827",
  uiSceneTree: true,
  uiBottomControls: true,
  uiHelperMessage: true,
};

const initializer = (set) => ({
  sceneObject: null,
  sceneData: null,
  loadStatus: "idle",
  loadError: "",
  loadedName: "",
  dragActive: false,
  prefs: { ...DEFAULT_PREFS },
  openPrefs: false,
  selectedNodeId: null,
  selectedNodeInfo: null,
  hiddenMeshIds: [],

  setDragActive: (active) => set({ dragActive: active }),
  beginLoad: (fileName) =>
    set({
      loadStatus: "loading",
      loadError: "",
      loadedName: fileName,
      sceneObject: null,
      sceneData: null,
      hiddenMeshIds: [],
      selectedNodeId: null,
      selectedNodeInfo: null,
    }),
  finishLoad: (sceneObject, sceneData) =>
    set({
      sceneObject,
      sceneData,
      loadStatus: "ready",
      hiddenMeshIds: [],
      selectedNodeId: null,
      selectedNodeInfo: null,
    }),
  failLoad: (errorMessage) =>
    set({
      sceneObject: null,
      sceneData: null,
      loadStatus: "error",
      loadError: errorMessage || "Unable to load file.",
      hiddenMeshIds: [],
      selectedNodeId: null,
      selectedNodeInfo: null,
    }),
  resetStatus: () =>
    set({ loadStatus: "idle", loadError: "", loadedName: "" }),
  clearScene: () =>
    set({
      sceneObject: null,
      sceneData: null,
      loadStatus: "idle",
      loadError: "",
      loadedName: "",
      hiddenMeshIds: [],
      selectedNodeId: null,
      selectedNodeInfo: null,
    }),
  setPrefs: (updater) =>
    set((state) => {
      const nextPrefs =
        typeof updater === "function" ? updater(state.prefs) : updater;
      return { prefs: { ...nextPrefs } };
    }),
  setOpenPrefs: (open) => set({ openPrefs: open }),
  restorePrefs: () => set({ prefs: { ...DEFAULT_PREFS } }),
  setSelectedNode: (node) =>
    set({
      selectedNodeId: node?.id ?? null,
      selectedNodeInfo: node ?? null,
    }),
  toggleMeshVisibility: (meshId) =>
    set((state) => {
      if (!meshId) return {};
      const hidden = new Set(state.hiddenMeshIds);
      if (hidden.has(meshId)) hidden.delete(meshId);
      else hidden.add(meshId);
      return { hiddenMeshIds: Array.from(hidden) };
    }),
  resetVisibility: () => set({ hiddenMeshIds: [] }),
});

export const useViewerStore = create(initializer);
