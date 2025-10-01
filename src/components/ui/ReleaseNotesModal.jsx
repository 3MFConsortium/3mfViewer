import React, { useMemo } from "react";

function ReleaseEntry({ version, items, highlight = false }) {
  return (
    <div className="group relative">
      <div className="absolute left-[10px] top-0 h-full w-px bg-slate-200 group-last:hidden" aria-hidden />
      <div className="relative grid gap-3 rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-sm transition group-hover:border-sky-200 group-hover:bg-sky-50/70">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] ${
            highlight ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"
          }`}>
            {version}
          </span>
          {highlight ? (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
              Current
            </span>
          ) : null}
        </div>
        <ul className="space-y-2 text-sm text-slate-600">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-300" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ReleaseNotesModal({
  title,
  subtitle,
  currentVersion,
  currentNotes,
  releaseNotes,
  showTimeline,
  onToggleTimeline,
}) {
  const timelineEntries = useMemo(() => {
    if (!releaseNotes) return [];
    return Object.entries(releaseNotes)
      .map(([version, notes]) => ({ version, notes: Array.isArray(notes) ? notes : [] }))
      .sort((a, b) => (a.version < b.version ? 1 : -1));
  }, [releaseNotes]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-slate-900">{title}</h4>
          {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          onClick={onToggleTimeline}
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-600 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
        >
          {showTimeline ? "Back to current release" : "View release history"}
        </button>
      </div>

      {showTimeline ? (
        timelineEntries.length ? (
          <div className="relative pl-4 sm:pl-6">
            <div className="absolute left-2 top-2 h-[calc(100%-1rem)] w-px bg-slate-200" aria-hidden />
            <div className="space-y-4">
              {timelineEntries.map((entry) => (
                <ReleaseEntry
                  key={entry.version}
                  version={entry.version}
                  items={entry.notes}
                  highlight={entry.version === currentVersion}
                />
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Release history will appear here once notes are available.</p>
        )
      ) : (
        <div className="space-y-4 text-sm text-slate-600">
          {currentNotes?.length ? (
            <ul className="space-y-2">
              {currentNotes.map((note, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-300" aria-hidden />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No release notes were recorded for this version yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
