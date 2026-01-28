/* global __APP_VERSION__ */

import React, {
  useMemo,
  useRef,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRafFps } from "../hooks/useRafFps.js";
import releaseNotes from "../release-notes.json" with { type: "json" };
import { useThreeMFLoader } from "../components/loaders/ThreeMFLoaderContext.js";
import { useViewerStore, DEFAULT_PREFS_LIGHT, DEFAULT_PREFS_DARK } from "../stores/viewerStore.js";
import { useTheme } from "../contexts/themeStore.js";
import { parseEmbedConfig, decodeBase64ToArrayBuffer } from "./embedConfig.js";
import { sampleModels } from "./sampleData.js";
import { useSceneLoading } from "../hooks/viewer/useSceneLoading.js";
import { useSceneTreeItems } from "../hooks/viewer/useSceneTreeItems.js";
import { useSliceView } from "../hooks/viewer/useSliceView.js";
import { useEmbedBridge } from "../hooks/viewer/useEmbedBridge.js";
import { useDragDrop } from "../hooks/viewer/useDragDrop.js";
import { usePointerTracking } from "../hooks/viewer/usePointerTracking.js";
import { useTouchGestures } from "../hooks/viewer/useTouchGestures.js";
import { useKeyboardShortcuts } from "../hooks/viewer/useKeyboardShortcuts.js";
import { useDockBehavior } from "../hooks/viewer/useDockBehavior.js";
import { useHelpCardEscape } from "../hooks/viewer/useHelpCardEscape.js";
import { useThemeSync } from "../hooks/viewer/useThemeSync.js";
import { ViewerLayout } from "./ViewerLayout.jsx";
import { getSceneBounds, getSliceMax, formatElapsed } from "./sceneMeta.js";
import { useViewerControls } from "../hooks/viewer/useViewerControls.js";
import { useCameraControls } from "../hooks/viewer/useCameraControls.js";

function ViewerApp() {
  const { load3mf, ensureLib3mf } = useThreeMFLoader();
  const sceneObject = useViewerStore((state) => state.viewer.sceneObject);
  const sceneData = useViewerStore((state) => state.viewer.sceneData);
  const loadStatus = useViewerStore((state) => state.viewer.loadStatus);
  const loadError = useViewerStore((state) => state.viewer.loadError);
  const loadedName = useViewerStore((state) => state.viewer.loadedName);
  const dragActive = useViewerStore((state) => state.viewer.dragActive);
  const renderReady = useViewerStore((state) => state.viewer.renderReady);
  const showScene = !!sceneObject;
  const prefs = useViewerStore((state) => state.prefs);
  const openPrefs = useViewerStore((state) => state.ui.openPrefs);
  const isCoarsePointer = useViewerStore((state) => state.ui.isCoarsePointer);
  const viewportWidth = useViewerStore((state) => state.ui.viewportWidth);
  const dockVisited = useViewerStore((state) => state.ui.dockVisited);
  const openReleaseNotes = useViewerStore((state) => state.ui.openReleaseNotes);
  const releaseNotesTimelineOpen = useViewerStore((state) => state.ui.releaseNotesTimelineOpen);
  const sampleLoading = useViewerStore((state) => state.specs.sampleLoading);
  const sampleError = useViewerStore((state) => state.specs.sampleError);
  const specUrls = useViewerStore((state) => state.specs.specUrls);
  const diagnosticsNotice = useViewerStore((state) => state.specs.diagnosticsNotice);
  const diagnosticsNoticeOpen = useViewerStore((state) => state.specs.diagnosticsNoticeOpen);
  const setDragActive = useViewerStore((state) => state.setDragActive);
  const beginLoad = useViewerStore((state) => state.beginLoad);
  const finishLoad = useViewerStore((state) => state.finishLoad);
  const setLoadingScene = useViewerStore((state) => state.setLoadingScene);
  const failLoad = useViewerStore((state) => state.failLoad);
  const clearScene = useViewerStore((state) => state.clearScene);
  const setPrefs = useViewerStore((state) => state.setPrefs);
  const setOpenPrefs = useViewerStore((state) => state.setOpenPrefs);
  const restorePrefs = useViewerStore((state) => state.restorePrefs);
  const setIsCoarsePointer = useViewerStore((state) => state.setIsCoarsePointer);
  const setViewportWidth = useViewerStore((state) => state.setViewportWidth);
  const setDockHintActive = useViewerStore((state) => state.setDockHintActive);
  const setDockCueActive = useViewerStore((state) => state.setDockCueActive);
  const setSampleLoading = useViewerStore((state) => state.setSampleLoading);
  const setSampleError = useViewerStore((state) => state.setSampleError);
  const setSpecUrls = useViewerStore((state) => state.setSpecUrls);
  const setSpecResults = useViewerStore((state) => state.setSpecResults);
  const setDiagnosticsNotice = useViewerStore((state) => state.setDiagnosticsNotice);
  const setDiagnosticsNoticeOpen = useViewerStore((state) => state.setDiagnosticsNoticeOpen);
  const setOpenReleaseNotes = useViewerStore((state) => state.setOpenReleaseNotes);
  const setReleaseNotesTimelineOpen = useViewerStore((state) => state.setReleaseNotesTimelineOpen);
  const mobileNavOpen = useViewerStore((state) => state.ui.mobileNavOpen);
  const resetTransientUi = useViewerStore((state) => state.resetTransientUi);
  const resetTransientSpecs = useViewerStore((state) => state.resetTransientSpecs);
  const [canvasElement, setCanvasElement] = useState(null);
  const fps = useRafFps({ sample: 750 });
  const embedConfig = useMemo(() => parseEmbedConfig(), []);
  const isEmbedQuick = embedConfig.enabled && embedConfig.mode === "quick";
  const isEmbedTransparent = isEmbedQuick && embedConfig.transparent;
  const hiddenMeshIds = useViewerStore((state) => state.selection.hiddenMeshIds);
  const toggleMeshVisibility = useViewerStore((state) => state.toggleMeshVisibility);
  const selectedNodeId = useViewerStore((state) => state.selection.selectedNodeId);
  const selectedNodeInfo = useViewerStore((state) => state.selection.selectedNodeInfo);
  const setSelectedNode = useViewerStore((state) => state.setSelectedNode);
  const mobileDockOpen = useViewerStore((state) => state.ui.mobileDockOpen);
  const setMobileNavOpen = useViewerStore((state) => state.setMobileNavOpen);
  const setMobileDockOpen = useViewerStore((state) => state.setMobileDockOpen);
  const helpCardOpen = useViewerStore((state) => state.ui.helpCardOpen);
  const setHelpCardOpen = useViewerStore((state) => state.setHelpCardOpen);
  const toggleHelpCard = useViewerStore((state) => state.toggleHelpCard);
  const tabletDockCollapsed = useViewerStore((state) => state.ui.tabletDockCollapsed);
  const setTabletDockCollapsed = useViewerStore((state) => state.setTabletDockCollapsed);

  // Theme integration
  const { isDark } = useTheme();

  useThemeSync({
    prefs,
    isDark,
    setPrefs,
    defaultLight: DEFAULT_PREFS_LIGHT,
    defaultDark: DEFAULT_PREFS_DARK,
  });

  const {
    fileInputRef,
    loadProgress,
    loadStartMs,
    loadRate,
    loadLastUpdateMs,
    loadStage,
    handleLoadSample,
    loadFromArrayBuffer,
    handleLoadFile,
    handleFileInputChange,
    handleBrowseClick,
    checkSpecifications,
  } = useSceneLoading({
    load3mf,
    ensureLib3mf,
    beamLatticeLinesOnly: prefs.beamLatticeMode === "lines",
    specUrls,
    beginLoad,
    finishLoad,
    setLoadingScene,
    failLoad,
    setDiagnosticsNotice,
    setDiagnosticsNoticeOpen,
    setSpecUrls,
    setSpecResults,
    setSampleLoading,
    setSampleError,
    setDragActive,
    resetTransientUi,
    resetTransientSpecs,
    setMobileNavOpen,
  });

  // ---------- samples & home content ----------

  // ---------- scene prefs ----------
  // ---------- tree data ----------
  const treeItems = useSceneTreeItems(sceneData, sceneObject);

  const sceneBounds = useMemo(() => getSceneBounds(sceneObject), [sceneObject]);
  const sliceMax = useMemo(() => getSliceMax(sceneData), [sceneData]);

  useSliceView(sceneObject, prefs.sliceIndex, sliceMax);

  // ---------- refs ----------
  const controlsRef = useRef(null);
  const contentRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const embedReadyRef = useRef(false);
  const embedSrcLoadedRef = useRef(null);

  const handleToggleWireframe = useCallback(
    (enabled) => {
      setPrefs((p) => ({ ...p, wireframe: enabled, edges: enabled ? false : p.edges }));
    },
    [setPrefs]
  );

  const handleToggleEdges = useCallback(
    (enabled) => {
      setPrefs((p) => ({ ...p, edges: enabled, wireframe: enabled ? false : p.wireframe }));
    },
    [setPrefs]
  );



  useDragDrop(handleLoadFile, setDragActive);
  usePointerTracking(setIsCoarsePointer, setViewportWidth);

  // live background
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setClearColor(
        prefs.background,
        isEmbedTransparent ? 0.0 : 1.0
      );
    }
  }, [prefs.background, isEmbedTransparent]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    if (!isEmbedTransparent) return undefined;
    const previousBody = document.body.style.background;
    const previousHtml = document.documentElement.style.background;
    document.body.style.background = "transparent";
    document.documentElement.style.background = "transparent";
    return () => {
      document.body.style.background = previousBody;
      document.documentElement.style.background = previousHtml;
    };
  }, [isEmbedTransparent]);

  const {
    initialCamPos,
    initialTarget,
    handleZoomIn,
    handleZoomOut,
    handleFit,
    handleResetView,
    panLeft,
    panRight,
    panUp,
    panDown,
  } = useCameraControls({
    controlsRef,
    cameraRef,
    contentRef,
    rendererRef,
    sceneObject,
    loadStatus,
  });

  useEmbedBridge({
    embedConfig,
    sceneObject,
    loadFromArrayBuffer,
    clearScene,
    handleFit,
    handleResetView,
    decodeBase64ToArrayBuffer,
    embedReadyRef,
    embedSrcLoadedRef,
  });

  // Arrow keys: keep keyboard panning even without on-screen D-pad
  // ? key: toggle help modal
  useKeyboardShortcuts({
    panLeft,
    panRight,
    panUp,
    panDown,
    toggleHelpCard,
  });

  // screenshot
  const handleScreenshot = useCallback(() => {
    const r = rendererRef.current;
    if (!r) return;
    requestAnimationFrame(() => {
      try {
        const url = r.domElement.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = url;
        a.download = `threemfviewer_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (e) {
        console.error("Screenshot failed", e);
      }
    });
  }, []);

  const showSceneTree = showScene && prefs.uiSceneTree && !isEmbedQuick;
  const showBottomBar = showScene && prefs.uiBottomControls && !isEmbedQuick;

  const pageHeightClass = showScene || isEmbedQuick ? "h-screen" : "min-h-screen";
  const pageBackgroundClass = isEmbedTransparent
    ? "bg-transparent"
    : dragActive
    ? "bg-accent-subtle"
    : "bg-background";

  const coarseTabletBreakpoint = 1024;
  const showTouchFab = isCoarsePointer && viewportWidth < coarseTabletBreakpoint;
  const showTouchTabletFull = isCoarsePointer && viewportWidth >= coarseTabletBreakpoint;

  const viewerControls = useViewerControls({
    prefs,
    setPrefs,
    handleZoomIn,
    handleZoomOut,
    handleFit,
    handleResetView,
    handleScreenshot,
    handleToggleWireframe,
    handleToggleEdges,
  });

  const progressPercent = loadProgress?.totalTriangles
    ? Math.min(100, Math.round((loadProgress.triangles / loadProgress.totalTriangles) * 100))
    : null;
  const progressLabel = loadProgress?.currentResourceName
    ? `Loading ${loadProgress.currentResourceName}`
    : `Loading ${loadedName || "3MF"}`;
  const progressSubLabel = loadProgress?.resourceTotal
    ? `Mesh ${loadProgress.resourceIndex} of ${loadProgress.resourceTotal}${loadProgress?.isTextured ? " • Textured mesh (slower)" : ""}`
    : loadStage?.detail || "Parsing 3MF + building task list…";
  const elapsedLabel = loadStartMs ? formatElapsed(performance.now() - loadStartMs) : "0s";
  const rateLabel = loadRate
    ? `${Math.round(loadRate).toLocaleString()} tri/s`
    : null;
  const lastUpdateLabel = loadLastUpdateMs
    ? formatElapsed(performance.now() - loadLastUpdateMs)
    : null;

  useEffect(() => {
    if (!showScene) {
      setCanvasElement(null);
      setMobileNavOpen(false);
    }
  }, [showScene, setMobileNavOpen]);

  useDockBehavior({
    showSceneTree,
    showScene,
    showBottomBar,
    isCoarsePointer,
    showTouchFab,
    showTouchTabletFull,
    dockVisited,
    tabletDockCollapsed,
    mobileDockOpen,
    setMobileNavOpen,
    setMobileDockOpen,
    setTabletDockCollapsed,
    setDockHintActive,
    setDockCueActive,
  });

  useTouchGestures(canvasElement, handleFit, handleResetView);
  useHelpCardEscape(helpCardOpen, setHelpCardOpen);

  const groundY = sceneBounds ? sceneBounds.min.y - 0.01 : -1;

  const appVersion = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
  const currentNotes = Array.isArray(releaseNotes?.[appVersion]) ? releaseNotes[appVersion] : null;

  return (
    <ViewerLayout
      pageHeightClass={pageHeightClass}
      pageBackgroundClass={pageBackgroundClass}
      dragActive={dragActive}
      loadStatus={loadStatus}
      renderReady={renderReady}
      isEmbedQuick={isEmbedQuick}
      prefsUiSceneTree={prefs.uiSceneTree}
      loadProgress={loadProgress}
      loadStage={loadStage}
      progressLabel={progressLabel}
      progressSubLabel={progressSubLabel}
      progressPercent={progressPercent}
      elapsedLabel={elapsedLabel}
      rateLabel={rateLabel}
      lastUpdateLabel={lastUpdateLabel}
      fileInputRef={fileInputRef}
      handleFileInputChange={handleFileInputChange}
      showScene={showScene}
      initialCamPos={initialCamPos}
      initialTarget={initialTarget}
      controlsRef={controlsRef}
      cameraRef={cameraRef}
      rendererRef={rendererRef}
      setCanvasElement={setCanvasElement}
      contentRef={contentRef}
      groundY={groundY}
      isEmbedTransparent={isEmbedTransparent}
      showSceneTree={showSceneTree}
      treeItems={treeItems}
      handleLoadFile={handleLoadFile}
      loadedName={loadedName}
      loadError={loadError}
      sceneMetadata={sceneData?.metadata}
      setSelectedNode={setSelectedNode}
      selectedNodeId={selectedNodeId}
      selectedNodeInfo={selectedNodeInfo}
      toggleMeshVisibility={toggleMeshVisibility}
      hiddenMeshIds={hiddenMeshIds}
      checkSpecifications={checkSpecifications}
      mobileNavOpen={mobileNavOpen}
      setMobileNavOpen={setMobileNavOpen}
      clearScene={clearScene}
      fps={fps}
      toggleHelpCard={toggleHelpCard}
      isCoarsePointer={isCoarsePointer}
      showBottomBar={showBottomBar}
      showTouchTabletFull={showTouchTabletFull}
      showTouchFab={showTouchFab}
      viewerControls={viewerControls}
      helpCardOpen={helpCardOpen}
      setHelpCardOpen={setHelpCardOpen}
      sampleModels={sampleModels}
      sampleLoading={sampleLoading}
      sampleError={sampleError}
      handleLoadSample={handleLoadSample}
      handleBrowseClick={handleBrowseClick}
      appVersion={appVersion}
      diagnosticsNoticeOpen={diagnosticsNoticeOpen}
      diagnosticsNotice={diagnosticsNotice}
      setDiagnosticsNoticeOpen={setDiagnosticsNoticeOpen}
      openPrefs={openPrefs}
      setOpenPrefs={setOpenPrefs}
      restorePrefs={restorePrefs}
      prefs={prefs}
      setPrefs={setPrefs}
      openReleaseNotes={openReleaseNotes}
      releaseNotesTimelineOpen={releaseNotesTimelineOpen}
      setOpenReleaseNotes={setOpenReleaseNotes}
      setReleaseNotesTimelineOpen={setReleaseNotesTimelineOpen}
      currentNotes={currentNotes}
      releaseNotes={releaseNotes}
    />
  );
}

export default ViewerApp;
