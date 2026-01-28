import React from "react";
import { useViewerStore } from "../../stores/viewerStore.js";
import { useTheme } from "../../contexts/themeStore.js";
import { IconMenu, IconQuestion, IconPrefs, IconSun, IconMoon, IconMonitor } from "../ui/Icons.jsx";

export function ViewerHud({
  showScene,
  fps,
  onBackToStart,
  onToggleHelp,
  hidden = false,
  hasSidenav = false,
}) {
  const showSceneTree = useViewerStore((state) => state.prefs.uiSceneTree);
  const showStats = useViewerStore((state) => state.prefs.showStats);
  const mobileNavOpen = useViewerStore((state) => state.ui.mobileNavOpen);
  const toggleMobileNav = useViewerStore((state) => state.toggleMobileNav);
  const setOpenPrefs = useViewerStore((state) => state.setOpenPrefs);

  const { theme, cycleTheme } = useTheme();

  const fpsLabel = Number.isFinite(fps) && fps > 0 ? Math.round(fps) : "--";

  const ThemeIcon = theme === "light" ? IconSun : theme === "dark" ? IconMoon : IconMonitor;
  const themeLabel = theme === "light" ? "Light mode" : theme === "dark" ? "Dark mode" : "System theme";

  // On desktop with sidenav, navbar and overlays start after sidenav
  const leftOffset = hasSidenav ? "lg:left-72" : "lg:left-0";

  if (hidden) return null;

  return (
    <>
      <div className={`pointer-events-none fixed left-0 right-0 top-0 z-30 ${leftOffset}`}>
        <div className="pointer-events-auto flex w-full items-center justify-between lg:justify-end border-b-2 border-border bg-surface-elevated px-4 py-2.5 sm:px-6">
          {/* Mobile menu button - hidden on desktop */}
          <div className="flex flex-1 items-center gap-2 lg:hidden">
            {showScene ? (
              <button
                type="button"
                aria-label="Open scene navigator"
                aria-expanded={mobileNavOpen}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground shadow transition hover:bg-accent-hover"
                onClick={toggleMobileNav}
                disabled={!showSceneTree}
              >
                <IconMenu />
              </button>
            ) : (
              <span className="h-9 w-9" />
            )}
          </div>

          {/* Mobile center logo - hidden on desktop */}
          <div className="flex flex-none items-center justify-center lg:hidden">
            <button
              type="button"
              onClick={onBackToStart}
              className="inline-flex items-center rounded-full p-1 transition hover:bg-surface"
              aria-label="Return to home"
            >
              <img
                src="/3mf_logo.png"
                alt="3MF"
                className="h-6 w-auto select-none dark-invert sm:h-7"
                draggable={false}
              />
            </button>
          </div>

          {/* Right buttons */}
          <div className="flex flex-1 lg:flex-none items-center justify-end gap-2">
            <button
              type="button"
              aria-label={themeLabel}
              title={themeLabel}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-elevated text-text-secondary shadow-sm ring-1 ring-border transition hover:bg-surface hover:text-text-primary"
              onClick={cycleTheme}
            >
              <ThemeIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="Open preferences"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground shadow transition hover:bg-accent-hover"
              onClick={() => setOpenPrefs(true)}
            >
              <IconPrefs />
            </button>
            <button
              type="button"
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-elevated text-text-secondary shadow-sm ring-1 ring-border transition hover:bg-surface hover:text-text-primary"
              onClick={onToggleHelp}
            >
              <IconQuestion />
            </button>
          </div>
        </div>
      </div>

      {showScene && showStats && (
        <div className="pointer-events-none fixed right-4 top-16 z-30 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-text-muted">
          {`${fpsLabel} FPS`}
        </div>
      )}
    </>
  );
}
