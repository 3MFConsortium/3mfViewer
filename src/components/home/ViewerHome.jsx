import React from "react";

export function ViewerHome({
  showScene,
  dragActive,
  backgroundClass,
  heroHeading,
  heroSubtext,
  dropHint,
  browseButtonClass,
  loadStatus,
  onBrowseClick,
  sampleModels,
  sampleLoading,
  sampleError,
  onLoadSample,
  upcomingCards,
  renderingRoadmap,
  getStatusMeta,
  onOpenReleaseNotes,
  appVersion,
}) {
  const loadingBrowse = loadStatus === "loading";
  const browseDisabled = dragActive || loadingBrowse;
  const sampleBusy = !!sampleLoading || loadingBrowse;
  const dropMessage = dragActive ? "Release to load your file." : dropHint;

  return (
    <div className={`relative w-full overflow-hidden transition-colors duration-300 ${backgroundClass}`}>
      <div className="pointer-events-none absolute -left-32 top-16 h-72 w-72 rounded-full bg-sky-200/35 blur-3xl floating-bubble" />
      <div className="pointer-events-none absolute right-[-40px] bottom-[-64px] h-80 w-80 rounded-full bg-indigo-200/35 blur-3xl floating-bubble" />
      <div className="pointer-events-none absolute right-12 top-24 hidden h-56 w-56 rounded-full bg-emerald-200/30 blur-3xl floating-bubble sm:block" />

      <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="flex flex-col gap-8">
            <section className="rounded-3xl border border-slate-200 bg-white/95 p-8 shadow-xl shadow-slate-200/60">
              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                <span className="floating-chip floating-chip--primary">3MF Viewer</span>
                <span className="floating-chip">Open source</span>
                <span className="floating-chip">No installs</span>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <img src="/3mf_logo.png" alt="3MF" className="h-12 w-auto opacity-90 sm:h-14" />
              </div>
              <div className="mt-6 space-y-4">
                <h2 className="text-3xl font-semibold leading-tight text-slate-900 sm:text-4xl lg:text-5xl">
                  {heroHeading}
                </h2>
                <p className="text-base text-slate-600 sm:text-lg">{heroSubtext}</p>
              </div>
              <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
                <button
                  type="button"
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-base font-medium shadow-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white sm:w-auto ${
                    browseDisabled
                      ? "cursor-not-allowed bg-slate-200 text-slate-500"
                      : `${browseButtonClass} shadow-lg`
                  }`}
                  onClick={onBrowseClick}
                  disabled={browseDisabled}
                >
                  <span>{loadingBrowse ? "Loading…" : "Browse for 3MF"}</span>
                </button>
                <p className="text-sm text-slate-600 sm:text-base">{dropMessage}</p>
              </div>
            </section>

            {!dragActive && (
              <>
                <section className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-lg shadow-slate-200/60">
                  <header className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                        Sample library
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        Load curated 3MF models covering colours, materials, and component hierarchies.
                      </p>
                    </div>
                    <span className="inline-flex items-center rounded-full border border-sky-300/60 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-600">
                      Instant preview
                    </span>
                  </header>
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    {sampleModels.map((s) => {
                      const isLoading = sampleLoading === s.name;
                      return (
                        <button
                          key={s.name}
                          type="button"
                          onClick={() => onLoadSample(s)}
                          disabled={sampleBusy}
                          className={`group flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white/95 px-5 py-5 text-left shadow-sm shadow-slate-200/60 transition hover:border-sky-200 hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                            isLoading ? "ring-2 ring-sky-300 bg-sky-50/90" : ""
                          } ${sampleBusy && !isLoading ? "opacity-70" : ""}`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-800 group-hover:text-slate-900">
                              {s.name}
                            </p>
                            {s.badge && (
                              <span className="inline-flex items-center rounded-full border border-sky-300/60 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-600">
                                {s.badge}
                              </span>
                            )}
                          </div>
                          {s.description && (
                            <p className="mt-3 text-sm text-slate-600 group-hover:text-slate-700">
                              {s.description}
                            </p>
                          )}
                          <span
                            className={`mt-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] ${
                              isLoading ? "text-sky-600" : "text-slate-500 group-hover:text-sky-600"
                            }`}
                          >
                            {isLoading ? "Loading…" : "Load sample"}
                            {!isLoading && <span aria-hidden className="text-base leading-none">→</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {sampleError && (
                    <div className="mt-4 text-xs text-rose-600">
                      {sampleError} Please try again or use Browse.
                    </div>
                  )}
                </section>

              </>
            )}
          </div>

          {!dragActive && (
            <aside className="flex flex-col gap-6 lg:ml-auto lg:max-w-sm">
              <section className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-lg shadow-slate-200/60">
                <header>
                  <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Road map</h3>
                  <p className="mt-2 text-sm text-slate-600">Track enhancements rolling into the viewer next.</p>
                </header>
                <ul className="mt-4 space-y-3">
                  {renderingRoadmap.map((entry) => {
                    if (entry.items) {
                      return (
                        <li
                          key={entry.label}
                          className="space-y-3 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm"
                        >
                          <div className="flex items-start gap-3">
                            <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full bg-slate-400" />
                            <p className="flex flex-wrap items-baseline gap-2 text-sm font-semibold text-slate-800">
                              {entry.label}
                              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Core spec
                              </span>
                            </p>
                          </div>
                          <ul className="space-y-2 pl-5">
                            {entry.items.map((feature) => {
                              const { dotClass, labelClass, stateLabel } = getStatusMeta(feature.status);
                              return (
                                <li
                                  key={feature.label}
                                  className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white/98 px-3 py-2.5"
                                >
                                  <span className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${dotClass}`} />
                                  <p className="flex flex-wrap items-baseline gap-2 text-sm font-semibold text-slate-800">
                                    {feature.label}
                                    <span
                                      className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${labelClass}`}
                                    >
                                      {stateLabel}
                                    </span>
                                  </p>
                                </li>
                              );
                            })}
                          </ul>
                        </li>
                      );
                    }

                    const { dotClass, labelClass, stateLabel } = getStatusMeta(entry.status);
                    return (
                      <li
                        key={entry.label}
                        className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-sm"
                      >
                        <span className={`mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full ${dotClass}`} />
                        <p className="flex flex-wrap items-baseline gap-2 text-sm font-semibold text-slate-800">
                          {entry.label}
                          <span className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${labelClass}`}>
                            {stateLabel}
                          </span>
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className="rounded-3xl border border-slate-200 bg-white/95 p-6 shadow-lg shadow-slate-200/60">
                <header className="flex items-center gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-600">
                      W
                    </span>
                    <p className="text-base font-semibold text-slate-700">Workflows</p>
                  </div>
                </header>
                <div className="mt-5 grid gap-4">
                  {upcomingCards.map((card) => (
                    <div
                      key={card.title}
                      className={`rounded-2xl border p-4 shadow-sm shadow-slate-200/50 transition ${
                        card.status?.toLowerCase().includes("live")
                          ? "border-emerald-200 bg-emerald-50/80"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <p className="text-sm font-semibold text-slate-800">{card.title}</p>
                      <p className="mt-2 text-sm text-slate-600">{card.caption}</p>
                      <span
                        className={`mt-3 inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${
                          card.status?.toLowerCase().includes("live")
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {card.status}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          )}
        </div>

        {!dragActive && !showScene && (
          <footer className="mt-16 flex flex-col items-center gap-1 text-xs text-slate-500 sm:gap-2">
            <button
              type="button"
              className="text-sm font-semibold text-slate-600 transition hover:text-slate-800"
              onClick={onOpenReleaseNotes}
            >
              v{appVersion} release notes
            </button>
            <span>Developed by 3MF Consortium</span>
          </footer>
        )}
      </div>
    </div>
  );
}
