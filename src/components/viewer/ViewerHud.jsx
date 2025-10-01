import React from "react";
import { IconMenu, IconQuestion, IconPrefs } from "../ui/Icons.jsx";

export function ViewerHud({
  showScene,
  showSceneTree,
  mobileNavOpen,
  onOpenNav,
  showStats,
  fps,
  helpAvailable,
  helpButtonRef,
  helpCardOpen,
  onToggleHelp,
  onBackToStart,
  onOpenPrefs,
}) {
  const fpsLabel = Number.isFinite(fps) && fps > 0 ? Math.round(fps) : "--";

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 top-0 z-30">
        <div className="pointer-events-auto flex w-full items-center justify-between border-b border-slate-200/70 bg-white/80 px-4 py-2.5 backdrop-blur-md shadow-md sm:px-6">
          <div className="flex flex-1 items-center gap-2">
            {showScene ? (
              <button
                type="button"
                aria-label="Open scene navigator"
                aria-expanded={mobileNavOpen}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white shadow transition hover:bg-slate-800 lg:hidden"
                onClick={onOpenNav}
                disabled={!showSceneTree}
              >
                <IconMenu />
              </button>
            ) : (
              <span className="h-9 w-9" />
            )}

            {showScene ? (
              <button
                type="button"
                onClick={onBackToStart}
                className="hidden items-center rounded-full p-1 transition hover:bg-slate-100 lg:flex"
                aria-label="Return to home"
              >
                <img
                  src="/3mf_logo.png"
                  alt="3MF"
                  className="h-6 w-auto select-none opacity-80"
                  draggable={false}
                />
              </button>
            ) : (
              <img
                src="/3mf_logo.png"
                alt="3MF"
                className="hidden h-6 w-auto select-none opacity-80 lg:block"
                draggable={false}
              />
            )}
          </div>

          <div className="flex flex-none items-center justify-center lg:hidden">
            <button
              type="button"
              onClick={onBackToStart}
              className="inline-flex items-center rounded-full p-1 transition hover:bg-slate-100"
              aria-label="Return to home"
            >
              <img
                src="/3mf_logo.png"
                alt="3MF"
                className="h-6 w-auto select-none opacity-80 sm:h-7"
                draggable={false}
              />
            </button>
          </div>

          <div className="flex flex-1 items-center justify-end gap-2">
            <button
              type="button"
              aria-label="Open preferences"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white shadow transition hover:bg-slate-800"
              onClick={onOpenPrefs}
            >
              <IconPrefs />
            </button>
          </div>
        </div>
      </div>

      {showScene && helpAvailable && (
        <div className="pointer-events-none fixed bottom-4 right-4 z-40 hidden lg:flex">
          <button
            ref={helpButtonRef}
            type="button"
            aria-label="Show viewer tips"
            aria-expanded={helpCardOpen}
            onClick={onToggleHelp}
            className={`pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl ring-1 ring-white/10 transition hover:bg-slate-800 ${
              helpCardOpen ? "" : "animate-pulse"
            }`}
          >
            <IconQuestion />
          </button>
        </div>
      )}

      {showScene && showStats && (
        <div className="pointer-events-none fixed left-3 bottom-3 z-30 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-900/60" style={{ textShadow: "0 1px 2px rgba(255, 255, 255, 0.6)" }}>
          {`${fpsLabel} FPS`}
        </div>
      )}
    </>
  );
}
