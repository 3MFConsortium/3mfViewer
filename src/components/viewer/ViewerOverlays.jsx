import React from "react";
import { useViewerStore } from "../../stores/viewerStore.js";

import { BottomControls } from "../ui/BottomControls.jsx";
import { SliceSlider } from "../ui/SliceSlider.jsx";
import { IconDock, IconClose } from "../ui/Icons.jsx";

export function ViewerOverlays({
  showDesktopBottomBar,
  showTabletDock,
  showTouchFab,
  controls,
  minimal = false,
  hasSidenav = false,
}) {
  const loadStatus = useViewerStore((state) => state.viewer.loadStatus);
  const loadedName = useViewerStore((state) => state.viewer.loadedName);
  const loadError = useViewerStore((state) => state.viewer.loadError);
  const mobileDockOpen = useViewerStore((state) => state.ui.mobileDockOpen);
  const tabletDockCollapsed = useViewerStore((state) => state.ui.tabletDockCollapsed);
  const dockHintActive = useViewerStore((state) => state.ui.dockHintActive);
  const dockCueActive = useViewerStore((state) => state.ui.dockCueActive);
  const toggleMobileDock = useViewerStore((state) => state.toggleMobileDock);
  const setMobileDockOpen = useViewerStore((state) => state.setMobileDockOpen);
  const toggleTabletDock = useViewerStore((state) => state.toggleTabletDock);

  const renderBottomControls = (extraProps = {}) => {
    return (
      <BottomControls
      onZoomIn={controls.onZoomIn}
      onZoomOut={controls.onZoomOut}
      onFit={controls.onFit}
      onResetView={controls.onResetView}
      onScreenshot={controls.onScreenshot}
      gridOn={controls.gridOn}
      statsOn={controls.statsOn}
      onToggleGrid={controls.onToggleGrid}
      onToggleStats={controls.onToggleStats}
      wireframeOn={controls.wireframeOn}
      edgesOn={controls.edgesOn}
      onToggleWireframe={controls.onToggleWireframe}
      onToggleEdges={controls.onToggleEdges}
      hasSidenav={hasSidenav}
      {...extraProps}
    />
    );
  };

  if (minimal) {
    return (
      <>
        <SliceSlider position="bottom" />
        <div className="pointer-events-none fixed right-3 top-3 z-40">
          <div className="group pointer-events-auto flex min-w-[2.2rem] items-center justify-center gap-0 rounded-full border border-border bg-surface-elevated/85 px-2 py-1 text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-text-secondary shadow-md backdrop-blur">
            <img src="/3mf_logo.png" alt="3MF" className="h-3.5 w-auto" />
            <span className="max-w-0 overflow-hidden whitespace-nowrap pl-0 opacity-0 transition-all duration-200 group-hover:max-w-xs group-hover:pl-2 group-hover:opacity-100">
              Powered by 3MF Consortium
            </span>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SliceSlider />

      {showDesktopBottomBar && renderBottomControls()}

      {showTabletDock && (
        <>
          {!tabletDockCollapsed ? (
            <div className={`fixed left-0 right-0 bottom-4 z-50 flex justify-center px-4 ${hasSidenav ? "lg:left-72" : ""}`}>
              <div className="pointer-events-auto w-full max-w-3xl">
                {renderBottomControls({
                  position: "static",
                  className: dockCueActive ? "animate-pulse" : "",
                  endCap: (
                    <button
                      type="button"
                      aria-label="Hide controls"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-elevated/95 text-text-muted ring-1 ring-border/40 transition hover:bg-surface-elevated"
                      onClick={toggleTabletDock}
                    >
                      <IconClose />
                    </button>
                  ),
                })}
              </div>
            </div>
          ) : (
            <div className="pointer-events-none fixed bottom-4 right-4 z-50">
              <div
                className={`pointer-events-auto gradient-halo rounded-full p-[3px] transition-opacity ${dockHintActive ? "opacity-100" : "opacity-70"
                  }`}
              >
                <button
                  type="button"
                  aria-label="Show viewer controls"
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-xl ring-1 ring-accent-hover/30 transition hover:bg-accent-hover"
                  onClick={toggleTabletDock}
                >
                  <IconDock />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {showTouchFab && (
        <>
          <div className="pointer-events-none fixed bottom-4 right-4 z-50">
            <div
              className={`pointer-events-auto gradient-halo rounded-full p-[3px] transition-opacity ${dockHintActive ? "opacity-100" : "opacity-70"
                }`}
            >
              <button
                type="button"
                aria-label="Toggle viewer controls"
                aria-expanded={mobileDockOpen}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-xl ring-1 ring-accent-hover/30 transition hover:bg-accent-hover"
                onClick={toggleMobileDock}
              >
                <IconDock />
              </button>
            </div>
          </div>
          {mobileDockOpen && (
            <>
              <div className="fixed inset-0 z-40 bg-background/50 backdrop-blur-sm" onClick={() => setMobileDockOpen(false)} />
              <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
                <div className="pointer-events-none flex w-full max-w-lg flex-col items-center gap-3">
                  <div
                    className={`pointer-events-auto rounded-full bg-surface-elevated/95 px-4 py-1 text-xs text-text-secondary shadow ring-1 ring-border ${dockCueActive ? "animate-pulse" : ""
                      }`}
                  >
                    Tap a control below to adjust the scene • Tap outside to close
                  </div>
                  {renderBottomControls({ position: "static", className: `pointer-events-auto lg:hidden ${dockCueActive ? "animate-pulse" : ""}` })}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {loadStatus === "loading" && (
        <div className={`pointer-events-none fixed left-0 right-0 top-16 z-40 flex justify-center ${hasSidenav ? "lg:left-72" : ""}`}>
          <div className="rounded-md bg-warning-subtle/95 px-3 py-1.5 text-xs text-warning shadow ring-1 ring-warning/30">
            Loading {loadedName || "3MF"}…
          </div>
        </div>
      )}
      {loadStatus === "error" && (
        <div className={`pointer-events-none fixed left-0 right-0 top-16 z-40 flex justify-center ${hasSidenav ? "lg:left-72" : ""}`}>
          <div className="rounded-md bg-error-subtle/95 px-3 py-1.5 text-xs text-error shadow ring-1 ring-error/30">
            {loadError || "Failed to load file"}
          </div>
        </div>
      )}
    </>
  );
}
