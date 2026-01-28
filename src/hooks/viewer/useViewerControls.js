import { useMemo } from "react";

export const useViewerControls = ({
  prefs,
  setPrefs,
  handleZoomIn,
  handleZoomOut,
  handleFit,
  handleResetView,
  handleScreenshot,
  handleToggleWireframe,
  handleToggleEdges,
}) =>
  useMemo(
    () => ({
      onZoomIn: handleZoomIn,
      onZoomOut: handleZoomOut,
      onFit: handleFit,
      onResetView: handleResetView,
      onScreenshot: handleScreenshot,
      gridOn: prefs.grid,
      groundOn: prefs.ground,
      statsOn: prefs.showStats,
      onToggleGrid: () => setPrefs((p) => ({ ...p, grid: !p.grid })),
      onToggleGround: () => setPrefs((p) => ({ ...p, ground: !p.ground })),
      onToggleStats: () => setPrefs((p) => ({ ...p, showStats: !p.showStats })),
      wireframeOn: prefs.wireframe,
      edgesOn: prefs.edges,
      onToggleWireframe: handleToggleWireframe,
      onToggleEdges: handleToggleEdges,
    }),
    [
      handleZoomIn,
      handleZoomOut,
      handleFit,
      handleResetView,
      handleScreenshot,
      handleToggleWireframe,
      handleToggleEdges,
      prefs,
      setPrefs,
    ]
  );
