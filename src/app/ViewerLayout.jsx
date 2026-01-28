import React from "react";

import { ViewerLoadingOverlay } from "../components/viewer/ViewerLoadingOverlay.jsx";
import { ViewerHelpCard } from "../components/viewer/ViewerHelpCard.jsx";
import { ViewerOverlays } from "../components/viewer/ViewerOverlays.jsx";
import { ViewerHud } from "../components/viewer/ViewerHud.jsx";
import { ViewerScene } from "../components/viewer/ViewerScene.jsx";
import { ViewerHome } from "../components/home/ViewerHome.jsx";
import { ViewerModals } from "./ViewerModals.jsx";
import { ViewerScenePanels } from "../components/viewer/ViewerScenePanels.jsx";

export function ViewerLayout({
  pageHeightClass,
  pageBackgroundClass,
  dragActive,
  loadStatus,
  renderReady,
  isEmbedQuick,
  prefsUiSceneTree,
  loadProgress,
  loadStage,
  progressLabel,
  progressSubLabel,
  progressPercent,
  elapsedLabel,
  rateLabel,
  lastUpdateLabel,
  fileInputRef,
  handleFileInputChange,
  showScene,
  initialCamPos,
  initialTarget,
  controlsRef,
  cameraRef,
  rendererRef,
  setCanvasElement,
  contentRef,
  groundY,
  isEmbedTransparent,
  showSceneTree,
  treeItems,
  handleLoadFile,
  loadedName,
  loadError,
  sceneMetadata,
  setSelectedNode,
  selectedNodeId,
  selectedNodeInfo,
  toggleMeshVisibility,
  hiddenMeshIds,
  checkSpecifications,
  mobileNavOpen,
  setMobileNavOpen,
  clearScene,
  fps,
  toggleHelpCard,
  isCoarsePointer,
  showBottomBar,
  showTouchTabletFull,
  showTouchFab,
  viewerControls,
  helpCardOpen,
  setHelpCardOpen,
  sampleModels,
  sampleLoading,
  sampleError,
  handleLoadSample,
  handleBrowseClick,
  appVersion,
  diagnosticsNoticeOpen,
  diagnosticsNotice,
  setDiagnosticsNoticeOpen,
  openPrefs,
  setOpenPrefs,
  restorePrefs,
  prefs,
  setPrefs,
  openReleaseNotes,
  releaseNotesTimelineOpen,
  setOpenReleaseNotes,
  setReleaseNotesTimelineOpen,
  currentNotes,
  releaseNotes,
}) {
  return (
    <div
      className={`relative ${pageHeightClass} w-full overflow-x-hidden transition-colors duration-200 ${pageBackgroundClass}`}
    >
      <ViewerLoadingOverlay
        active={loadStatus === "loading" || (loadStatus === "ready" && !renderReady)}
        isEmbedQuick={isEmbedQuick}
        hasSidenav={!isEmbedQuick && prefsUiSceneTree}
        loadStatus={loadStatus}
        progressLabel={progressLabel}
        progressSubLabel={progressSubLabel}
        progressPercent={progressPercent}
        loadProgress={loadProgress}
        loadStage={loadStage}
        elapsedLabel={elapsedLabel}
        rateLabel={rateLabel}
        lastUpdateLabel={lastUpdateLabel}
      />
      <div
        className={`pointer-events-none absolute inset-0 transition-opacity duration-150 ${
          dragActive ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="absolute inset-0 bg-accent/10 backdrop-blur-[2px]" />
      </div>
      <div className={`relative z-20 ${pageHeightClass} w-full`}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".3mf"
          hidden
          onChange={handleFileInputChange}
        />

        <div
          className={`absolute inset-0 top-14 ${
            showScene && !isEmbedQuick && prefsUiSceneTree ? "lg:left-72" : ""
          }`}
        >
          <ViewerScene
            showScene={showScene}
            initialCamPos={initialCamPos}
            initialTarget={initialTarget}
            controlsRef={controlsRef}
            cameraRef={cameraRef}
            rendererRef={rendererRef}
            setCanvasElement={setCanvasElement}
            contentRef={contentRef}
            groundY={groundY}
            transparentBackground={isEmbedTransparent}
          />
        </div>

        <ViewerScenePanels
          showScene={showScene}
          isEmbedQuick={isEmbedQuick}
          showSceneTree={showSceneTree}
          treeItems={treeItems}
          handleLoadFile={handleLoadFile}
          loadStatus={loadStatus}
          loadedName={loadedName}
          loadError={loadError}
          sceneMetadata={sceneMetadata}
          setSelectedNode={setSelectedNode}
          selectedNodeId={selectedNodeId}
          selectedNodeInfo={selectedNodeInfo}
          toggleMeshVisibility={toggleMeshVisibility}
          hiddenMeshIds={hiddenMeshIds}
          checkSpecifications={checkSpecifications}
          mobileNavOpen={mobileNavOpen}
          setMobileNavOpen={setMobileNavOpen}
          clearScene={clearScene}
        />

        {showScene && !isEmbedQuick && (
          <ViewerHud
            showScene={showScene}
            fps={fps}
            onBackToStart={clearScene}
            onToggleHelp={toggleHelpCard}
            hidden={isEmbedQuick}
            hasSidenav={prefsUiSceneTree}
          />
        )}

        {((!showScene && loadStatus !== "loading") || dragActive) && !isEmbedQuick && (
          <ViewerHome
            dragActive={dragActive}
            loadStatus={loadStatus}
            onBrowseClick={handleBrowseClick}
            sampleModels={sampleModels}
            sampleLoading={sampleLoading}
            sampleError={sampleError}
            onLoadSample={handleLoadSample}
            version={appVersion}
          />
        )}

        <ViewerHelpCard
          open={helpCardOpen && !isEmbedQuick}
          onClose={() => setHelpCardOpen(false)}
        />

        <ViewerOverlays
          showDesktopBottomBar={showBottomBar && !isCoarsePointer}
          showTabletDock={showBottomBar && showTouchTabletFull}
          showTouchFab={showBottomBar && showTouchFab}
          controls={viewerControls}
          minimal={isEmbedQuick}
          hasSidenav={showScene && !isEmbedQuick && prefsUiSceneTree}
        />

        <ViewerModals
          isEmbedQuick={isEmbedQuick}
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
          appVersion={appVersion}
          currentNotes={currentNotes}
          releaseNotes={releaseNotes}
        />
      </div>
    </div>
  );
}
