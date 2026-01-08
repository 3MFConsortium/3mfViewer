import React from "react";
import { IconUpload } from "../ui/Icons.jsx";

export function ViewerHome({
  dragActive,
  loadStatus,
  onBrowseClick,
  sampleModels,
  sampleLoading,
  sampleError,
  onLoadSample,
  version = "dev",
}) {
  const loadingBrowse = loadStatus === "loading";
  const sampleBusy = !!sampleLoading || loadingBrowse;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-lg mx-4 rounded-3xl bg-surface-elevated shadow-2xl border border-border overflow-hidden">
        {/* Drag active overlay */}
        {dragActive && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-accent/10 border-2 border-dashed border-accent rounded-3xl">
            <div className="h-16 w-16 rounded-full bg-accent/20 flex items-center justify-center">
              <IconUpload className="w-8 h-8 text-accent" />
            </div>
            <p className="text-lg font-semibold text-accent">Release to load</p>
          </div>
        )}

        {/* Header with gradient */}
        <div className="relative px-8 pt-10 pb-6 text-center bg-gradient-to-b from-surface to-surface-elevated">
          {/* Logo */}
          <img
            src="/3mf_logo.png"
            alt="3MF"
            className="h-16 w-auto mx-auto dark-invert"
            draggable={false}
          />

          {/* Title */}
          <h1 className="mt-5 text-3xl font-bold text-text-primary tracking-tight">
            3MF Viewer
          </h1>

          {/* Subtitle */}
          <p className="mt-2 text-text-secondary text-sm">
            Open-source viewer for the 3D Manufacturing Format
          </p>

          {/* Browse Button */}
          <button
            type="button"
            className={`mt-6 inline-flex items-center justify-center gap-2.5 rounded-full px-8 py-3.5 text-base font-semibold transition-all ${
              loadingBrowse || dragActive
                ? "bg-surface text-text-muted cursor-not-allowed"
                : "bg-accent text-accent-foreground shadow-lg shadow-accent/25 hover:bg-accent-hover hover:shadow-xl hover:shadow-accent/30 hover:-translate-y-0.5"
            }`}
            onClick={onBrowseClick}
            disabled={loadingBrowse || dragActive}
          >
            <IconUpload className="w-5 h-5" />
            {loadingBrowse ? "Loading…" : "Browse for 3MF"}
          </button>

          <p className="mt-3 text-xs text-text-muted">
            Or drop a .3mf file anywhere
          </p>
        </div>

        {/* Sample Models Section */}
        {!dragActive && sampleModels && sampleModels.length > 0 && (
          <div className="px-8 py-6 border-t border-border bg-surface/50">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">
                Sample Models
              </p>
              <span className="text-xs text-text-muted">
                {sampleModels.length} available
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {sampleModels.map((sample) => {
                const isLoading = sampleLoading === sample.name;
                return (
                  <button
                    key={sample.name}
                    type="button"
                    onClick={() => onLoadSample(sample)}
                    disabled={sampleBusy}
                    className={`group relative rounded-xl px-3 py-2.5 text-left transition-all border ${
                      isLoading
                        ? "bg-accent text-accent-foreground border-accent"
                        : sampleBusy
                        ? "bg-surface text-text-muted border-border opacity-50 cursor-not-allowed"
                        : "bg-surface-elevated text-text-primary border-border hover:border-accent hover:bg-surface hover:shadow-md"
                    }`}
                  >
                    <span className={`block text-sm font-medium leading-tight ${isLoading ? "text-accent-foreground" : ""}`}>
                      {isLoading ? "Loading…" : sample.name}
                    </span>
                    {sample.badge && !isLoading && (
                      <span className={`inline-block mt-1.5 text-[0.6rem] font-medium px-1.5 py-0.5 rounded leading-none ${
                        sampleBusy
                          ? "bg-border text-text-muted"
                          : "bg-accent/10 text-accent"
                      }`}>
                        {sample.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {sampleError && (
              <p className="mt-3 text-xs text-error text-center">{sampleError}</p>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-8 py-4 bg-surface border-t border-border flex items-center justify-between">
          <span className="text-xs text-text-muted">
            3MF Consortium
          </span>
          <span className="text-xs font-mono text-text-muted bg-surface-elevated px-2 py-1 rounded">
            v{version}
          </span>
        </div>
      </div>
    </div>
  );
}
