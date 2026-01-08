import React from "react";
import {
  IconPlus,
  IconMinus,
  IconFit,
  IconCamera,
  IconReset,
  IconGrid,
  IconStats,
  IconWireframe,
  IconWireframeOverlay,
} from "./Icons.jsx";

function Btn({ title, onClick, active = false, children }) {
  return (
    <button
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={
        "inline-flex h-9 w-9 items-center justify-center rounded-full p-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:h-10 sm:w-10 sm:p-2.5 " +
        (active
          ? "bg-accent text-accent-foreground"
          : "bg-surface-elevated/20 text-text-primary hover:bg-surface-elevated/40 ring-1 ring-border/30")
      }
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-1 hidden h-8 w-px bg-border/30 lg:block" />;
}

export function BottomControls({
  onZoomIn,
  onZoomOut,
  onFit,
  onResetView,
  onScreenshot,
  gridOn,
  statsOn,
  onToggleGrid,
  onToggleStats,
  wireframeOn,
  edgesOn,
  onToggleWireframe,
  onToggleEdges,
  className = "",
  position = "fixed",
  endCap = null,
  hasSidenav = false,
}) {
  const isFixed = position === "fixed";
  // On desktop with sidenav, offset left to center within renderer area
  const sidenavOffset = hasSidenav ? "lg:left-72" : "";
  const outerBase = isFixed
    ? `fixed left-0 right-0 bottom-3 z-50 flex justify-center px-3 sm:bottom-4 ${sidenavOffset}`
    : "flex w-full justify-center";
  const innerBase =
    "flex w-full max-w-xl flex-wrap items-center justify-center gap-2 overflow-x-auto rounded-2xl glass-elevated px-3 py-2 shadow-xl";
  const innerResponsive = isFixed
    ? "sm:w-auto sm:max-w-none sm:justify-center sm:px-4 lg:flex-nowrap lg:gap-1 lg:rounded-full lg:px-3 lg:py-2.5"
    : "lg:flex-nowrap lg:gap-1 lg:rounded-full lg:px-3 lg:py-2.5";

  return (
    <div className={`${outerBase} ${className}`.trim()}>
      <div className={`${innerBase} ${innerResponsive}`.trim()}>
        {/* Zoom */}
        <Btn title="Zoom out" onClick={onZoomOut}><IconMinus /></Btn>
        <Btn title="Zoom in" onClick={onZoomIn}><IconPlus /></Btn>
        <Btn title="Fit to view" onClick={onFit}><IconFit /></Btn>

        <Divider />

        {/* Utility */}
        <Btn title="Reset view" onClick={onResetView}><IconReset /></Btn>
        <Btn title="Screenshot" onClick={onScreenshot}><IconCamera /></Btn>

        <Divider />

        {/* Toggles */}
        <Btn title="Grid helper"   onClick={onToggleGrid}   active={gridOn}><IconGrid /></Btn>
        <Btn title="Stats overlay" onClick={onToggleStats}  active={statsOn}><IconStats /></Btn>

        <Divider />

        {/* Render modes */}
        <Btn
          title={wireframeOn ? "Disable wireframe" : "Wireframe"}
          onClick={() => onToggleWireframe(!wireframeOn)}
          active={wireframeOn}
        >
          <IconWireframe />
        </Btn>
        <Btn
          title={edgesOn ? "Disable wireframe overlay" : "Wireframe + shaded"}
          onClick={() => onToggleEdges(!edgesOn)}
          active={edgesOn}
        >
          <IconWireframeOverlay />
        </Btn>

        {endCap ? <div className="ml-1 flex-shrink-0">{endCap}</div> : null}
      </div>
    </div>
  );
}
