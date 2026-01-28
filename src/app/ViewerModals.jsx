import React from "react";

import { Modal } from "../components/ui/Modal.jsx";
import { ScenePreferences } from "../components/ui/ScenePreferences.jsx";
import { ReleaseNotesModal } from "../components/ui/ReleaseNotesModal.jsx";

export function ViewerModals({
  isEmbedQuick,
  diagnosticsNoticeOpen,
  diagnosticsNotice,
  setDiagnosticsNoticeOpen,
  openPrefs,
  setOpenPrefs,
  restorePrefs,
  prefs,
  setPrefs,
  openReleaseNotes,
  releaseNotesTimelineOpen,
  setOpenReleaseNotes,
  setReleaseNotesTimelineOpen,
  appVersion,
  currentNotes,
  releaseNotes,
}) {
  if (isEmbedQuick) return null;

  return (
    <>
      <Modal
        open={diagnosticsNoticeOpen && !!diagnosticsNotice}
        title="Import issues detected"
        subtitle="Some diagnostics reported errors while reading this 3MF."
        onClose={() => setDiagnosticsNoticeOpen(false)}
        footer={
          <button
            onClick={() => setDiagnosticsNoticeOpen(false)}
            className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow transition hover:bg-accent-hover"
          >
            Got it
          </button>
        }
      >
        {diagnosticsNotice ? (
          <div className="space-y-4 text-sm text-text-secondary">
            <p>
              {`While importing ${diagnosticsNotice.fileName || "this model"}, lib3mf reported ${diagnosticsNotice.errors.toLocaleString()} error${diagnosticsNotice.errors === 1 ? "" : "s"
                }.`}
            </p>
            <div className="rounded-2xl border border-error/30 bg-error-subtle p-4">
              <div className="text-[0.75rem] font-semibold uppercase tracking-wide text-error">
                Errors detected
              </div>
              <div className="mt-1 text-2xl font-semibold text-error">
                {diagnosticsNotice.errors.toLocaleString()}
              </div>
              <p className="mt-2 text-[0.75rem] text-error">
                Portions of the scene or metadata may be incomplete or unreliable.
              </p>
            </div>
            {diagnosticsNotice.warnings > 0 ? (
              <div className="rounded-2xl border border-warning/30 bg-warning-subtle p-4">
                <div className="text-[0.75rem] font-semibold uppercase tracking-wide text-warning">
                  Warnings detected
                </div>
                <div className="mt-1 text-2xl font-semibold text-warning">
                  {diagnosticsNotice.warnings.toLocaleString()}
                </div>
                <p className="mt-2 text-[0.75rem] text-warning">
                  Review the diagnostics tab to see the most common warning groups.
                </p>
              </div>
            ) : null}
            <div className="rounded-2xl border border-border bg-surface-elevated p-4 text-[0.8rem] leading-relaxed">
              <p className="font-semibold text-text-primary">Next steps</p>
              <ul className="mt-2 space-y-1 text-text-secondary">
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-text-muted" />
                  <span>
                    Open the Diagnostics tab to review grouped issues and affected resources.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-text-muted" />
                  <span>
                    Consider validating the source 3MF in your authoring tool before re-exporting.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={openPrefs}
        title="Scene Preferences"
        subtitle="Adjust background, lighting, helpers. Changes apply immediately."
        onClose={() => setOpenPrefs(false)}
        footer={
          <button
            onClick={restorePrefs}
            className="rounded-md bg-surface-elevated text-text-secondary border border-border px-3 py-1.5 text-sm hover:bg-surface hover:text-text-primary transition"
          >
            Restore defaults
          </button>
        }
      >
        <ScenePreferences prefs={prefs} onChange={setPrefs} />
      </Modal>

      <Modal
        open={openReleaseNotes}
        title={`Release Notes – v${appVersion}`}
        subtitle={releaseNotesTimelineOpen ? "Full release history" : "What’s new in this build"}
        onClose={() => {
          setOpenReleaseNotes(false);
          setReleaseNotesTimelineOpen(false);
        }}
        size="lg"
      >
        <ReleaseNotesModal
          title={`Version v${appVersion}`}
          subtitle={releaseNotesTimelineOpen ? "All release entries" : "Highlights"}
          currentVersion={`v${appVersion}`}
          currentNotes={currentNotes}
          releaseNotes={releaseNotes}
          showTimeline={releaseNotesTimelineOpen}
          onToggleTimeline={() => setReleaseNotesTimelineOpen((prev) => !prev)}
        />
      </Modal>
    </>
  );
}
