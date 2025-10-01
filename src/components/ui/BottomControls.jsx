import React from "react";
import {
  IconPlus,
  IconMinus,
  IconFit,
  IconCamera,
  IconReset,
  IconGrid,
  IconGround,
  IconStats,
  IconShadows,
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
        "inline-flex h-9 w-9 items-center justify-center rounded-full p-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70 sm:h-10 sm:w-10 sm:p-2.5 " +
        (active
          ? "bg-white text-slate-900"
          : "bg-white/10 text-white hover:bg-white/20 ring-1 ring-white/20")
      }
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="mx-1 hidden h-8 w-px bg-white/20 lg:block" />;
}

export function BottomControls({
  onZoomIn,
  onZoomOut,
  onFit,
  onResetView,
  onScreenshot,
  gridOn,
  groundOn,
  statsOn,
  shadowsOn,
  onToggleGrid,
  onToggleGround,
  onToggleStats,
  onToggleShadows,
  wireframeOn,
  edgesOn,
  onToggleWireframe,
  onToggleEdges,
  className = "",
  position = "fixed",
  endCap = null,
}) {
  const isFixed = position === "fixed";
  const outerBase = isFixed
    ? "fixed inset-x-0 bottom-3 z-50 flex justify-center px-3 sm:bottom-4 sm:left-1/2 sm:right-auto sm:inset-auto sm:-translate-x-1/2 sm:px-0"
    : "flex w-full justify-center";
  const innerBase =
    "flex w-full max-w-xl flex-wrap items-center justify-center gap-2 overflow-x-auto rounded-2xl bg-slate-900/80 px-3 py-2 text-white backdrop-blur ring-1 ring-black/20 shadow-xl";
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
        <Btn title="Ground plane"  onClick={onToggleGround} active={groundOn}><IconGround /></Btn>
        <Btn title="Stats overlay" onClick={onToggleStats}  active={statsOn}><IconStats /></Btn>
        <Btn title="Shadows"       onClick={onToggleShadows} active={shadowsOn}><IconShadows /></Btn>

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
