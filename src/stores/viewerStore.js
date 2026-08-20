import { create } from "zustand";

// Light theme defaults
export const DEFAULT_PREFS_LIGHT = {
  background: "#f8fafc",
  hemiSkyColor: "#ffffff",
  hemiGroundColor: "#a7b1c2",
  rimColor: "#ffffff",
  edgeColor: "#111827",
  // Lighting intensities for light mode
  ambient: 0.85,
  hemiIntensity: 0.9,
  rimIntensity: 0.25,
};

// Dark theme defaults - brighter lighting to compensate for dark background
export const DEFAULT_PREFS_DARK = {
  background: "#1a1a1a",
  hemiSkyColor: "#e0e0e0",      // Much brighter sky for fill light
  hemiGroundColor: "#404040",   // Brighter ground reflection
  rimColor: "#ffffff",          // Strong white rim for definition
  edgeColor: "#111827",         // Dark edges contrast against mesh surface
  // Higher intensities for dark mode visibility
  ambient: 1.2,                 // Stronger ambient
  hemiIntensity: 1.1,           // Stronger hemisphere
  rimIntensity: 0.5,            // Stronger rim for edge definition
};

export const DEFAULT_PREFS = {
  background: "#f8fafc",
  ambient: 0.85,
  hemiIntensity: 0.9,
  hemiSkyColor: "#ffffff",
  hemiGroundColor: "#a7b1c2",
  rimIntensity: 0.25,
  rimColor: "#ffffff",
  ground: true,
  grid: false,
  showStats: true,
  wireframe: false,
  edges: false,
  edgeColor: "#111827",
  beamLatticeMode: "solid",
  uiSceneTree: true,
  uiBottomControls: true,
  uiHelperMessage: true,
  sliceIndex: -1,
  sliceOverview: true,
  // Theme sync: auto-adjust colors when theme changes
  syncWithTheme: true,
};

const PREFS_STORAGE_KEY = "3mfViewer:prefs:v2";

const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;
const BOOLEAN_PREFS = [
  "ground",
  "grid",
  "showStats",
  "wireframe",
  "edges",
  "uiSceneTree",
  "uiBottomControls",
  "uiHelperMessage",
  "sliceOverview",
  "syncWithTheme",
];
const COLOR_PREFS = [
  "background",
  "hemiSkyColor",
  "hemiGroundColor",
  "rimColor",
  "edgeColor",
];
const NUMBER_PREFS = {
  ambient: [0, 2],
  hemiIntensity: [0, 2],
  rimIntensity: [0, 1],
};

export const sanitizePrefs = (candidate) => {
  const source = candidate && typeof candidate === "object" ? candidate : {};
  const sanitized = { ...DEFAULT_PREFS };
  BOOLEAN_PREFS.forEach((key) => {
    if (typeof source[key] === "boolean") sanitized[key] = source[key];
  });
  COLOR_PREFS.forEach((key) => {
    if (typeof source[key] === "string" && COLOR_PATTERN.test(source[key])) {
      sanitized[key] = source[key];
    }
  });
  Object.entries(NUMBER_PREFS).forEach(([key, [min, max]]) => {
    const value = Number(source[key]);
    if (Number.isFinite(value)) sanitized[key] = Math.min(max, Math.max(min, value));
  });
  if (source.beamLatticeMode === "solid" || source.beamLatticeMode === "centerlines") {
    sanitized.beamLatticeMode = source.beamLatticeMode;
  } else if (source.beamLatticeMode === "lines") {
    sanitized.beamLatticeMode = "centerlines";
  }
  const sliceIndex = Number(source.sliceIndex);
  if (Number.isInteger(sliceIndex) && sliceIndex >= -1) sanitized.sliceIndex = sliceIndex;
  return sanitized;
};

const isEmbedMode = () => {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.has("embed");
  } catch {
    return false;
  }
};

const loadPrefs = () => {
  if (typeof window === "undefined") return { ...DEFAULT_PREFS };
  if (isEmbedMode()) return { ...DEFAULT_PREFS };
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_PREFS };
    return sanitizePrefs(parsed);
  } catch {
    return { ...DEFAULT_PREFS };
  }
};

const savePrefs = (prefs) => {
  if (typeof window === "undefined") return;
  if (isEmbedMode()) return;
  try {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
};

const initializer = (set) => ({
  viewer: {
    sceneObject: null,
    sceneData: null,
    loadStatus: "idle",
    loadError: "",
    loadedName: "",
    dragActive: false,
    renderReady: false,  // True after first frame with geometry is rendered
  },
  prefs: loadPrefs(),
  selection: {
    selectedNodeId: null,
    selectedNodeInfo: null,
    hiddenMeshIds: [],
  },
  ui: {
    openPrefs: false,
    sidenavCollapsed: false,
    mobileNavOpen: false,
    mobileDockOpen: false,
    helpCardOpen: false,
    tabletDockCollapsed: false,
    isCoarsePointer: false,
    viewportWidth: 1280,
    dockHintActive: true,
    dockCueActive: false,
    dockVisited: false,
    openReleaseNotes: false,
    releaseNotesTimelineOpen: false,
    scenePrefsActiveTab: "appearance",
  },
  specs: {
    sampleLoading: null,
    sampleError: null,
    specUrls: [],
    specResults: [],
    diagnosticsNotice: null,
    diagnosticsNoticeOpen: false,
  },
  runtime: {
    ready: false,
    error: null,
  },
  sceneTree: {
    panel: {
      modelInfoOpen: false,
      modelInfoTab: "summary",
      infoCollapsed: false,
      specModalOpen: false,
      specInputValue: "",
      materialModalOpen: false,
      localSpecResults: [],
    },
    drawer: {
      modelInfoOpen: false,
      modelInfoTab: "summary",
      infoCollapsed: false,
      specModalOpen: false,
      specInputValue: "",
      materialModalOpen: false,
      localSpecResults: [],
    },
  },

  setDragActive: (active) =>
    set((state) => ({ viewer: { ...state.viewer, dragActive: active } })),
  setRenderReady: (ready) =>
    set((state) => ({ viewer: { ...state.viewer, renderReady: ready } })),
  beginLoad: (fileName) =>
    set((state) => ({
      viewer: {
        ...state.viewer,
        loadStatus: "loading",
        loadError: "",
        loadedName: fileName,
        sceneObject: null,
        sceneData: null,
        renderReady: false,  // Reset render ready state
      },
      selection: {
        ...state.selection,
        hiddenMeshIds: [],
        selectedNodeId: null,
        selectedNodeInfo: null,
      },
    })),
  finishLoad: (sceneObject, sceneData) =>
    set((state) => ({
      viewer: {
        ...state.viewer,
        sceneObject,
        sceneData,
        loadStatus: "ready",
      },
      selection: {
        ...state.selection,
        hiddenMeshIds: [],
        selectedNodeId: null,
        selectedNodeInfo: null,
      },
    })),
  setLoadingScene: (sceneObject, sceneData) =>
    set((state) => ({
      viewer: {
        ...state.viewer,
        sceneObject,
        sceneData,
      },
    })),
  failLoad: (errorMessage) =>
    set((state) => ({
      viewer: {
        ...state.viewer,
        sceneObject: null,
        sceneData: null,
        loadStatus: "error",
        loadError: errorMessage || "Unable to load file.",
      },
      selection: {
        ...state.selection,
        hiddenMeshIds: [],
        selectedNodeId: null,
        selectedNodeInfo: null,
      },
    })),
  resetStatus: () =>
    set((state) => ({
      viewer: { ...state.viewer, loadStatus: "idle", loadError: "", loadedName: "" },
    })),
  clearScene: () =>
    set((state) => ({
      viewer: {
        ...state.viewer,
        sceneObject: null,
        sceneData: null,
        loadStatus: "idle",
        loadError: "",
        loadedName: "",
      },
      selection: {
        ...state.selection,
        hiddenMeshIds: [],
        selectedNodeId: null,
        selectedNodeInfo: null,
      },
    })),
  setPrefs: (updater) =>
    set((state) => {
      const nextPrefs =
        typeof updater === "function" ? updater(state.prefs) : updater;
      const sanitized = sanitizePrefs(nextPrefs);
      savePrefs(sanitized);
      return { prefs: sanitized };
    }),
  setOpenPrefs: (open) =>
    set((state) => ({ ui: { ...state.ui, openPrefs: open } })),
  restorePrefs: () => {
    savePrefs(DEFAULT_PREFS);
    set({ prefs: { ...DEFAULT_PREFS } });
  },
  setSelectedNode: (node) =>
    set((state) => ({
      selection: {
        ...state.selection,
        selectedNodeId: node?.id ?? null,
        selectedNodeInfo: node ?? null,
      },
    })),
  toggleMeshVisibility: (meshId) =>
    set((state) => {
      if (!meshId) return {};
      const hidden = new Set(state.selection.hiddenMeshIds);
      if (hidden.has(meshId)) hidden.delete(meshId);
      else hidden.add(meshId);
      return {
        selection: { ...state.selection, hiddenMeshIds: Array.from(hidden) },
      };
    }),
  setMeshVisibility: (meshId, visible) =>
    set((state) => {
      if (meshId === null || meshId === undefined || meshId === "") return {};
      const key = String(meshId);
      const hidden = new Set(state.selection.hiddenMeshIds.map(String));
      if (visible) hidden.delete(key);
      else hidden.add(key);
      return {
        selection: { ...state.selection, hiddenMeshIds: Array.from(hidden) },
      };
    }),
  setHiddenMeshIds: (meshIds) =>
    set((state) => ({
      selection: {
        ...state.selection,
        hiddenMeshIds: Array.from(
          new Set((Array.isArray(meshIds) ? meshIds : []).map(String).filter(Boolean))
        ),
      },
    })),
  isolateMeshIds: (allMeshIds, visibleMeshIds) =>
    set((state) => {
      const visible = new Set(
        (Array.isArray(visibleMeshIds) ? visibleMeshIds : []).map(String)
      );
      const hiddenMeshIds = (Array.isArray(allMeshIds) ? allMeshIds : [])
        .map(String)
        .filter((id) => id && !visible.has(id));
      return {
        selection: {
          ...state.selection,
          hiddenMeshIds: Array.from(new Set(hiddenMeshIds)),
        },
      };
    }),
  resetVisibility: () =>
    set((state) => ({
      selection: { ...state.selection, hiddenMeshIds: [] },
    })),
  setMobileNavOpen: (open) =>
    set((state) => ({ ui: { ...state.ui, mobileNavOpen: open } })),
  setSidenavCollapsed: (collapsed) =>
    set((state) => ({ ui: { ...state.ui, sidenavCollapsed: collapsed } })),
  toggleSidenav: () =>
    set((state) => ({ ui: { ...state.ui, sidenavCollapsed: !state.ui.sidenavCollapsed } })),
  setMobileDockOpen: (open) =>
    set((state) => ({ ui: { ...state.ui, mobileDockOpen: open } })),
  setHelpCardOpen: (open) =>
    set((state) => ({ ui: { ...state.ui, helpCardOpen: open } })),
  setTabletDockCollapsed: (collapsed) =>
    set((state) => ({ ui: { ...state.ui, tabletDockCollapsed: collapsed } })),
  setIsCoarsePointer: (value) =>
    set((state) => ({ ui: { ...state.ui, isCoarsePointer: value } })),
  setViewportWidth: (value) =>
    set((state) => ({ ui: { ...state.ui, viewportWidth: value } })),
  setDockHintActive: (active) =>
    set((state) => ({ ui: { ...state.ui, dockHintActive: active } })),
  setDockCueActive: (active) =>
    set((state) => ({ ui: { ...state.ui, dockCueActive: active } })),
  setDockVisited: (visited) =>
    set((state) => ({ ui: { ...state.ui, dockVisited: visited } })),
  setSampleLoading: (value) =>
    set((state) => ({ specs: { ...state.specs, sampleLoading: value } })),
  setSampleError: (value) =>
    set((state) => ({ specs: { ...state.specs, sampleError: value } })),
  setSpecUrls: (value) =>
    set((state) => ({
      specs: {
        ...state.specs,
        specUrls: Array.isArray(value) ? value : [],
      },
    })),
  setSpecResults: (value) =>
    set((state) => ({
      specs: {
        ...state.specs,
        specResults: Array.isArray(value) ? value : [],
      },
    })),
  setDiagnosticsNotice: (value) =>
    set((state) => ({ specs: { ...state.specs, diagnosticsNotice: value } })),
  setDiagnosticsNoticeOpen: (open) =>
    set((state) => ({ specs: { ...state.specs, diagnosticsNoticeOpen: open } })),
  clearDiagnosticsNotice: () =>
    set((state) => ({
      specs: { ...state.specs, diagnosticsNotice: null, diagnosticsNoticeOpen: false },
    })),
  setOpenReleaseNotes: (open) =>
    set((state) => ({ ui: { ...state.ui, openReleaseNotes: open } })),
  setReleaseNotesTimelineOpen: (open) =>
    set((state) => ({ ui: { ...state.ui, releaseNotesTimelineOpen: open } })),
  setRuntimeReady: (ready) =>
    set((state) => ({ runtime: { ...state.runtime, ready } })),
  setRuntimeError: (error) =>
    set((state) => ({ runtime: { ...state.runtime, error } })),
  resetTransientUi: () =>
    set((state) => ({
      ui: {
        ...state.ui,
        openPrefs: false,
        mobileNavOpen: false,
        mobileDockOpen: false,
        helpCardOpen: false,
        tabletDockCollapsed: false,
        dockHintActive: true,
        dockCueActive: false,
        dockVisited: false,
        openReleaseNotes: false,
        releaseNotesTimelineOpen: false,
        scenePrefsActiveTab: "appearance",
      },
      sceneTree: {
        ...state.sceneTree,
        panel: {
          ...state.sceneTree.panel,
          modelInfoOpen: false,
          modelInfoTab: "summary",
          infoCollapsed: false,
          specModalOpen: false,
          specInputValue: "",
          materialModalOpen: false,
          localSpecResults: [],
        },
        drawer: {
          ...state.sceneTree.drawer,
          modelInfoOpen: false,
          modelInfoTab: "summary",
          infoCollapsed: false,
          specModalOpen: false,
          specInputValue: "",
          materialModalOpen: false,
          localSpecResults: [],
        },
      },
    })),
  resetTransientSpecs: () =>
    set((state) => ({
      specs: {
        ...state.specs,
        sampleLoading: null,
        sampleError: null,
        diagnosticsNotice: null,
        diagnosticsNoticeOpen: false,
      },
    })),
  setSceneTreePanel: (updater) =>
    set((state) => {
      const next =
        typeof updater === "function" ? updater(state.sceneTree.panel) : updater;
      return { sceneTree: { ...state.sceneTree, panel: { ...state.sceneTree.panel, ...next } } };
    }),
  setSceneTreeDrawer: (updater) =>
    set((state) => {
      const next =
        typeof updater === "function" ? updater(state.sceneTree.drawer) : updater;
      return { sceneTree: { ...state.sceneTree, drawer: { ...state.sceneTree.drawer, ...next } } };
    }),
  setScenePrefsActiveTab: (tab) =>
    set((state) => ({ ui: { ...state.ui, scenePrefsActiveTab: tab } })),
  toggleMobileNav: () =>
    set((state) => ({
      ui: { ...state.ui, mobileNavOpen: !state.ui.mobileNavOpen },
    })),
  toggleMobileDock: () =>
    set((state) => ({
      ui: { ...state.ui, mobileDockOpen: !state.ui.mobileDockOpen },
    })),
  toggleHelpCard: () =>
    set((state) => ({
      ui: { ...state.ui, helpCardOpen: !state.ui.helpCardOpen },
    })),
  toggleTabletDock: () =>
    set((state) => ({
      ui: { ...state.ui, tabletDockCollapsed: !state.ui.tabletDockCollapsed },
    })),
});

export const useViewerStore = create(initializer);
