import React from "react";

import { SceneTree } from "../ui/SceneTree.jsx";

export function ViewerScenePanels({
  showScene,
  isEmbedQuick,
  showSceneTree,
  treeItems,
  handleLoadFile,
  loadStatus,
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
}) {
  if (!showScene || isEmbedQuick || !showSceneTree) return null;

  return (
    <>
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-72 border-r border-border bg-surface-elevated z-30">
        <div className="flex items-center justify-center border-b-2 border-border px-4 py-2.5">
          <button
            type="button"
            onClick={clearScene}
            className="inline-flex items-center rounded-full p-1 transition hover:bg-surface"
            aria-label="Return to home"
          >
            <img
              src="/3mf_logo.png"
              alt="3MF"
              className="h-7 w-auto select-none dark-invert"
              draggable={false}
            />
          </button>
        </div>
        <SceneTree
          items={treeItems}
          onSelectFile={handleLoadFile}
          loadStatus={loadStatus}
          fileName={loadedName}
          errorMessage={loadError}
          metadata={sceneMetadata}
          onSelectNode={setSelectedNode}
          selectedNodeId={selectedNodeId}
          selectedInfo={selectedNodeInfo}
          onToggleMeshVisibility={toggleMeshVisibility}
          hiddenMeshIds={hiddenMeshIds}
          onUpdateSpecifications={checkSpecifications}
        />
      </aside>

      <SceneTree
        items={treeItems}
        onSelectFile={handleLoadFile}
        loadStatus={loadStatus}
        fileName={loadedName}
        errorMessage={loadError}
        metadata={sceneMetadata}
        variant="drawer"
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        className="lg:hidden"
        onSelectNode={setSelectedNode}
        selectedNodeId={selectedNodeId}
        selectedInfo={selectedNodeInfo}
        onToggleMeshVisibility={toggleMeshVisibility}
        hiddenMeshIds={hiddenMeshIds}
        onUpdateSpecifications={checkSpecifications}
      />
    </>
  );
}
