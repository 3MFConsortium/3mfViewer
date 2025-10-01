import React from "react";

import { BottomControls } from "../ui/BottomControls.jsx";
import { IconDock, IconClose, IconQuestion } from "../ui/Icons.jsx";

export function ViewerOverlays({
  showDesktopBottomBar,
  showTabletDock,
  tabletDockCollapsed,
  onCollapseTabletDock,
  onExpandTabletDock,
  showTouchFab,
  dockHintActive,
  dockCueActive,
  onToggleMobileDock,
  mobileDockOpen,
  onCloseMobileDock,
  controls,
  loadStatus,
  loadedName,
  loadError,
  helpAvailable,
  helpButtonRef,
  helpCardOpen,
  onToggleHelp,
}) {
  const renderBottomControls = (extraProps = {}) => (
    <BottomControls
      onZoomIn={controls.onZoomIn}
      onZoomOut={controls.onZoomOut}
      onFit={controls.onFit}
      onResetView={controls.onResetView}
      onScreenshot={controls.onScreenshot}
      gridOn={controls.gridOn}
      groundOn={controls.groundOn}
      statsOn={controls.statsOn}
      shadowsOn={controls.shadowsOn}
      onToggleGrid={controls.onToggleGrid}
      onToggleGround={controls.onToggleGround}
      onToggleStats={controls.onToggleStats}
      onToggleShadows={controls.onToggleShadows}
      wireframeOn={controls.wireframeOn}
      edgesOn={controls.edgesOn}
      onToggleWireframe={controls.onToggleWireframe}
      onToggleEdges={controls.onToggleEdges}
      {...extraProps}
    />
  );

  return (
    <>
      {showDesktopBottomBar && renderBottomControls()}

      {showTabletDock && (
        <>
          {!tabletDockCollapsed ? (
            <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
              <div className="pointer-events-auto w-full max-w-3xl">
                {renderBottomControls({
                  position: "static",
                  className: dockCueActive ? "animate-pulse" : "",
                  endCap: (
                    <button
                      type="button"
                      aria-label="Hide controls"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-slate-500 ring-1 ring-white/40 transition hover:bg-white"
                      onClick={onCollapseTabletDock}
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
                className={`pointer-events-auto gradient-halo rounded-full p-[3px] transition-opacity ${
                  dockHintActive ? "opacity-100" : "opacity-70"
                }`}
              >
                <button
                  type="button"
                  aria-label="Show viewer controls"
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900/95 text-white shadow-xl ring-1 ring-white/10 transition hover:bg-slate-900"
                  onClick={onExpandTabletDock}
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
              className={`pointer-events-auto gradient-halo rounded-full p-[3px] transition-opacity ${
                dockHintActive ? "opacity-100" : "opacity-70"
              }`}
            >
              <button
                type="button"
                aria-label="Toggle viewer controls"
                aria-expanded={mobileDockOpen}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900/95 text-white shadow-xl ring-1 ring-white/10 transition hover:bg-slate-900"
                onClick={onToggleMobileDock}
              >
                <IconDock />
              </button>
            </div>
          </div>
          {mobileDockOpen && (
            <>
              <div className="fixed inset-0 z-40 bg-slate-900/30" onClick={onCloseMobileDock} />
              <div className="fixed inset-x-0 bottom-24 z-50 flex justify-center px-4">
                <div className="pointer-events-none flex w-full max-w-lg flex-col items-center gap-3">
                  <div
                    className={`pointer-events-auto rounded-full bg-white/95 px-4 py-1 text-xs text-slate-600 shadow ring-1 ring-slate-200 ${
                      dockCueActive ? "animate-pulse" : ""
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

      {helpAvailable && (
        <div
          className={`pointer-events-none fixed right-4 z-50 flex lg:hidden ${
            showTouchFab ? "bottom-24" : "bottom-4"
          }`}
        >
          <div className="pointer-events-auto gradient-halo rounded-full p-[3px]">
            <button
              ref={helpButtonRef}
              type="button"
              aria-label="Show viewer tips"
              aria-expanded={helpCardOpen}
              onClick={onToggleHelp}
              className={`flex h-12 w-12 items-center justify-center rounded-full bg-slate-900/95 text-white shadow-xl ring-1 ring-white/10 transition hover:bg-slate-900 ${
                helpCardOpen ? "" : "animate-pulse"
              }`}
            >
              <IconQuestion />
            </button>
          </div>
        </div>
      )}

      {loadStatus === "loading" && (
        <div className="pointer-events-none fixed left-1/2 top-16 -translate-x-1/2 rounded-md bg-amber-100/95 px-3 py-1.5 text-xs text-amber-800 shadow ring-1 ring-amber-200">
          Loading {loadedName || "3MF"}…
        </div>
      )}
      {loadStatus === "error" && (
        <div className="pointer-events-none fixed left-1/2 top-16 -translate-x-1/2 rounded-md bg-rose-100/95 px-3 py-1.5 text-xs text-rose-800 shadow ring-1 ring-rose-200">
          {loadError || "Failed to load file"}
        </div>
      )}
    </>
  );
}
