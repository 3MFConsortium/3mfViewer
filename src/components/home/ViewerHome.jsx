import React, { useState } from "react";
import { IconUpload, IconArrowLeft } from "../ui/Icons.jsx";
import releaseNotes from "../../release-notes.json" with { type: "json" };

export function ViewerHome({
  dragActive,
  loadStatus,
  onBrowseClick,
  sampleModels,
  renderingRoadmap,
  upcomingCards,
  getStatusMeta,
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
    <div className="fixed inset-0 z-40 overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.9),_rgba(244,244,245,0.96)_32%,_rgba(228,228,231,0.92)_100%)]">
      <div className="relative mx-auto flex min-h-full w-full max-w-7xl items-center px-4 py-5 sm:px-6 sm:py-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.72),rgba(255,255,255,0))]" />
        <div className="pointer-events-none absolute left-[-5rem] top-10 h-72 w-72 rounded-full bg-white/80 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-6rem] right-[-2rem] h-80 w-80 rounded-full bg-zinc-200/60 blur-3xl" />
        <div className="grid w-full gap-5 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-white/78 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl">
        {/* Drag active overlay */}
        {dragActive && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-accent bg-white/80 backdrop-blur-md">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
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
            <div className="relative overflow-hidden border-b border-black/6 px-6 pb-8 pt-8 sm:px-10 sm:pt-10">
              <div className="absolute inset-x-0 top-0 h-full bg-[radial-gradient(circle_at_top,_rgba(250,250,250,0.98),rgba(255,255,255,0.7)_58%,rgba(244,244,245,0.55)_100%)]" />
              <div className="pointer-events-none absolute -right-12 top-8 h-44 w-44 rounded-full border border-black/5 bg-[radial-gradient(circle,_rgba(255,255,255,0.9),rgba(228,228,231,0.25))]" />
              <div className="relative">
                <div className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-zinc-700 shadow-sm">
                  3MF Consortium
                </div>

                <div className="mt-7 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
                  <div>
                    <img
                      src="/3mf_logo.png"
                      alt="3MF"
                      className="h-12 w-auto dark-invert sm:h-16"
                      draggable={false}
                    />

                    <h1 className="mt-6 max-w-xl text-4xl font-bold tracking-[-0.04em] text-zinc-950 sm:text-5xl">
                      Inspect 3MF models without leaving the browser.
                    </h1>

                    <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base">
                      Review meshes, colours, materials, slice stacks, diagnostics, and component structure in a client-side viewer built for the 3D Manufacturing Format.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                    <div className="rounded-2xl border border-black/6 bg-white/80 px-4 py-3 shadow-sm">
                      <div className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                        Focus
                      </div>
                      <div className="mt-1 text-sm font-semibold text-zinc-900">
                        Viewer + diagnostics
                      </div>
                    </div>
                    <div className="rounded-2xl border border-black/6 bg-white/80 px-4 py-3 shadow-sm">
                      <div className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                        Runtime
                      </div>
                      <div className="mt-1 text-sm font-semibold text-zinc-900">
                        Fully client-side
                      </div>
                    </div>
                    <div className="rounded-2xl border border-black/6 bg-white/80 px-4 py-3 shadow-sm">
                      <div className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-zinc-400">
                        Input
                      </div>
                      <div className="mt-1 text-sm font-semibold text-zinc-900">
                        Drop a `.3mf` file
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    className={`inline-flex w-full items-center justify-center gap-2.5 rounded-full px-6 py-3 text-base font-semibold transition-all sm:w-auto sm:px-8 sm:py-3.5 ${
                  loadingBrowse || dragActive
                    ? "cursor-not-allowed bg-zinc-200 text-zinc-500"
                    : "bg-zinc-700 text-white shadow-[0_14px_32px_rgba(63,63,70,0.16)] hover:-translate-y-0.5 hover:bg-zinc-600"
                  }`}
                    onClick={onBrowseClick}
                    disabled={loadingBrowse || dragActive}
                  >
                    <IconUpload className="w-5 h-5" />
                    {loadingBrowse ? "Loading…" : "Browse for 3MF"}
                  </button>

                  <p className="text-sm text-zinc-500">
                    Or drop a `.3mf` file anywhere on the page.
                  </p>
                </div>
              </div>
            </div>

            {/* Sample Models Section */}
            {!dragActive && sampleModels && sampleModels.length > 0 && (
              <div className="px-6 py-6 sm:px-10">
                <div className="mb-5 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-400">
                    Sample Models
                  </p>
                  <span className="text-xs text-zinc-400">
                    {sampleModels.length} available
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {sampleModels.map((sample) => {
                    const isLoading = sampleLoading === sample.name;
                    return (
                      <button
                        key={sample.name}
                        type="button"
                        onClick={() => onLoadSample(sample)}
                        disabled={sampleBusy}
                        className={`group relative overflow-hidden rounded-[1.35rem] border px-4 py-4 text-left transition-all ${
                          isLoading
                            ? "border-zinc-700 bg-zinc-700 text-white"
                            : sampleBusy
                            ? "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400 opacity-60"
                            : "border-zinc-200/90 bg-white text-zinc-900 shadow-sm hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg"
                        }`}
                      >
                        <span className={`block text-base font-semibold leading-tight tracking-[-0.02em] ${isLoading ? "text-white" : ""}`}>
                          {isLoading ? "Loading…" : sample.name}
                        </span>
                        {sample.description && !isLoading && (
                          <span className="mt-2 block text-sm leading-6 text-zinc-600">
                            {sample.description}
                          </span>
                        )}
                        {sample.badge && !isLoading && (
                          <span className={`mt-4 inline-flex rounded-full px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.18em] leading-none ${
                            sampleBusy
                              ? "bg-zinc-200 text-zinc-400"
                              : "bg-zinc-100 text-zinc-600"
                          }`}>
                            {sample.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {sampleError && (
                  <p className="mt-3 text-center text-xs text-error">{sampleError}</p>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="mt-auto flex items-center justify-between border-t border-black/6 bg-zinc-50/60 px-6 py-4 sm:px-10">
              <a
                href="https://3mf.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-zinc-500 transition-colors hover:text-zinc-900"
              >
                3MF Consortium
              </a>
              <button
                type="button"
                onClick={() => setShowReleaseNotes(true)}
                className="cursor-pointer rounded-full border border-black/8 bg-white px-3 py-1.5 text-xs font-mono text-zinc-500 transition-colors hover:text-zinc-900"
              >
                v{version}
              </button>
            </div>
          </>
        )}
          </div>

          {!dragActive && (
            <aside className="flex flex-col gap-5">
              <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/78 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-6">
                <h2 className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">
                  Supported Extensions
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Current format coverage and active implementation areas.
                </p>
                <div className="mt-4 space-y-3">
                  {renderingRoadmap?.map((entry) => {
                    if (entry.items) {
                      return (
                        <div key={entry.label} className="rounded-[1.4rem] border border-zinc-200/80 bg-zinc-50/70 p-4">
                          <div className="text-sm font-semibold text-zinc-900">{entry.label}</div>
                          <ul className="mt-3 space-y-2">
                            {entry.items.map((feature) => {
                              const meta = getStatusMeta?.(feature.status);
                              return (
                                <li key={feature.label} className="flex items-center justify-between gap-3 rounded-2xl bg-white px-3 py-2.5 shadow-sm">
                                  <span className="text-sm text-zinc-600">{feature.label}</span>
                                  <span className={`inline-flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] ${meta?.labelClass || "text-text-muted"}`}>
                                    <span className={`h-2 w-2 rounded-full ${meta?.dotClass || "bg-slate-400"}`} />
                                    {meta?.stateLabel || "In progress"}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    }

                    const meta = getStatusMeta?.(entry.status);
                    return (
                      <div key={entry.label} className="flex items-center justify-between gap-3 rounded-[1.4rem] border border-zinc-200/80 bg-zinc-50/70 px-4 py-3">
                        <span className="text-sm font-semibold text-zinc-900">{entry.label}</span>
                        <span className={`inline-flex items-center gap-2 text-[0.65rem] font-semibold uppercase tracking-[0.18em] ${meta?.labelClass || "text-text-muted"}`}>
                          <span className={`h-2 w-2 rounded-full ${meta?.dotClass || "bg-slate-400"}`} />
                          {meta?.stateLabel || "In progress"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/78 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-6">
                <h2 className="text-xs font-semibold uppercase tracking-[0.24em] text-zinc-400">
                  Work In Progress
                </h2>
                <div className="mt-4 grid gap-3">
                  {upcomingCards?.map((card) => (
                    <div key={card.title} className="rounded-[1.4rem] border border-zinc-200/80 bg-zinc-50/70 px-4 py-4">
                      <div className="text-sm font-semibold text-zinc-900">{card.title}</div>
                      <div className="mt-2 text-sm leading-6 text-zinc-600">{card.caption}</div>
                      <div className="mt-4 inline-flex rounded-full bg-zinc-200 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-zinc-700">
                        {card.status}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
