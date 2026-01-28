import React, { useState } from "react";
import { IconUpload, IconArrowLeft } from "../ui/Icons.jsx";
import releaseNotes from "../../release-notes.json";

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
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);

  // Get sorted version keys (newest first)
  const versionKeys = Object.keys(releaseNotes).sort((a, b) => {
    const partsA = a.split(".").map(Number);
    const partsB = b.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      if (partsB[i] !== partsA[i]) return partsB[i] - partsA[i];
    }
    return 0;
  });

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm px-3 py-4 sm:px-6 sm:py-8">
      <div className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface-elevated shadow-2xl sm:rounded-3xl max-h-[calc(100dvh-2rem)]">
        {/* Drag active overlay */}
        {dragActive && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-accent/10 border-2 border-dashed border-accent rounded-3xl">
            <div className="h-16 w-16 rounded-full bg-accent/20 flex items-center justify-center">
              <IconUpload className="w-8 h-8 text-accent" />
            </div>
            <p className="text-lg font-semibold text-accent">Release to load</p>
          </div>
        )}

        {showReleaseNotes ? (
          /* Release Notes View */
          <>
            <div className="px-5 pt-6 pb-4 border-b border-border bg-gradient-to-b from-surface to-surface-elevated sm:px-8">
              <button
                type="button"
                onClick={() => setShowReleaseNotes(false)}
                className="inline-flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary bg-surface-elevated hover:bg-border px-3 py-1.5 rounded-full transition-colors"
              >
                <IconArrowLeft />
                Back
              </button>
              <h2 className="mt-4 text-2xl font-bold text-text-primary tracking-tight">
                Release Notes
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                What's new in 3MF Viewer
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
              {versionKeys.map((ver, idx) => (
                <div key={ver} className={idx > 0 ? "mt-6 pt-6 border-t border-border" : ""}>
                  <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                    v{ver}
                    {ver === version && (
                      <span className="text-[0.6rem] font-medium px-1.5 py-0.5 rounded bg-accent/10 text-accent uppercase">
                        Current
                      </span>
                    )}
                  </h3>
                  <ul className="mt-2 space-y-1.5">
                    {releaseNotes[ver].map((note, i) => (
                      <li key={i} className="text-xs text-text-secondary leading-relaxed flex gap-2">
                        <span className="text-text-muted shrink-0">•</span>
                        <span>{note}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="px-5 py-4 bg-surface border-t border-border sm:px-8">
              <a
                href="https://3mf.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                3MF Consortium
              </a>
            </div>
          </>
        ) : (
          /* Main View */
          <>
            {/* Header with gradient */}
            <div className="relative px-5 pt-8 pb-6 text-center bg-gradient-to-b from-surface to-surface-elevated sm:px-8 sm:pt-10">
              {/* Logo */}
              <img
                src="/3mf_logo.png"
                alt="3MF"
                className="h-12 w-auto mx-auto dark-invert sm:h-16"
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
                className={`mt-6 inline-flex w-full items-center justify-center gap-2.5 rounded-full px-6 py-3 text-base font-semibold transition-all sm:w-auto sm:px-8 sm:py-3.5 ${
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
              <div className="flex-1 overflow-y-auto px-5 py-6 border-t border-border bg-surface/50 sm:px-8">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-text-muted">
                    Sample Models
                  </p>
                  <span className="text-xs text-text-muted">
                    {sampleModels.length} available
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
            <div className="px-5 py-4 bg-surface border-t border-border flex items-center justify-between sm:px-8">
              <a
                href="https://3mf.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-text-muted hover:text-text-primary transition-colors"
              >
                3MF Consortium
              </a>
              <button
                type="button"
                onClick={() => setShowReleaseNotes(true)}
                className="text-xs font-mono text-text-muted bg-surface-elevated px-2 py-1 rounded hover:bg-border hover:text-text-primary transition-colors cursor-pointer"
              >
                v{version}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
