import React from "react";

export function ViewerLoadingOverlay({
  active,
  isEmbedQuick,
  hasSidenav,
  loadStatus,
  progressLabel,
  progressSubLabel,
  progressPercent,
  loadProgress,
  loadStage,
  elapsedLabel,
  rateLabel,
  lastUpdateLabel,
}) {
  if (!active) return null;

  return (
    <div
      className="fixed inset-0 z-50"
      onWheel={(event) => event.preventDefault()}
      onTouchMove={(event) => event.preventDefault()}
    >
      <div className="absolute inset-0 bg-background/30 backdrop-blur-[2px]" />
      <div
        className={`absolute inset-0 flex items-center justify-center px-6 ${
          loadStatus === "ready" && hasSidenav ? "lg:left-72" : ""
        }`}
      >
        {isEmbedQuick ? (
          <div className="pointer-events-none w-full max-w-[min(90vw,320px)] rounded-2xl glass-elevated px-5 py-4 text-center shadow-xl">
            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-border border-t-accent" />
            <div className="mt-3 text-sm font-semibold text-text-primary">
              {loadStatus === "ready" ? "Rendering…" : progressLabel}
            </div>
            <div className="mt-1 text-[0.7rem] text-text-secondary">
              {loadStatus === "ready" ? "Preparing scene" : progressSubLabel}
            </div>
            {loadStage?.stage && loadStatus === "loading" ? (
              <div className="mt-1 text-[0.6rem] uppercase tracking-[0.25em] text-text-muted">
                Stage {loadStage.stage.replace(/-/g, " ")}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="pointer-events-none w-full max-w-lg rounded-3xl glass-elevated px-6 py-5 text-center shadow-2xl">
            <div className="text-sm font-semibold text-text-primary">
              {loadStatus === "ready" ? "Rendering scene…" : progressLabel}
            </div>
            <div className="mt-1 text-xs text-text-secondary">
              {loadStatus === "ready"
                ? "Compiling shaders and uploading to GPU"
                : progressSubLabel}
            </div>
            {loadStage?.stage && loadStatus === "loading" ? (
              <div className="mt-1 text-[0.6rem] uppercase tracking-[0.25em] text-text-muted">
                Stage {loadStage.stage.replace(/-/g, " ")}
              </div>
            ) : null}
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent via-accent-hover to-success transition-all"
                style={{ width: loadStatus === "ready" ? "100%" : `${progressPercent ?? 5}%` }}
              />
            </div>
            <div className="mt-2 text-[0.7rem] text-text-secondary">
              {loadStatus === "ready"
                ? "Almost there…"
                : progressPercent !== null
                  ? `${progressPercent}% • ${
                      loadProgress?.triangles?.toLocaleString() ?? 0
                    } / ${loadProgress?.totalTriangles?.toLocaleString() ?? 0} tri`
                  : "Building geometry…"}
            </div>
            {loadStatus === "loading" && (
              <div className="mt-1 text-[0.65rem] text-text-muted">
                Elapsed {elapsedLabel}
                {rateLabel ? ` • ${rateLabel}` : ""}
                {lastUpdateLabel ? ` • Last update ${lastUpdateLabel} ago` : ""}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
