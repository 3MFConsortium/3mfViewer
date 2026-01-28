import React from "react";

import { IconClose } from "../ui/Icons.jsx";

export function ViewerHelpCard({ open, onClose }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl bg-surface-elevated shadow-2xl border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">Keyboard Shortcuts</h2>
            <button
              type="button"
              aria-label="Close"
              className="rounded-full p-1.5 text-text-muted transition hover:bg-surface hover:text-text-primary"
              onClick={onClose}
            >
              <IconClose />
            </button>
          </div>
          <p className="mt-1 text-xs text-text-muted">Press Esc to close</p>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">
              Mouse Controls
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Orbit</span>
                <kbd className="px-2 py-1 rounded bg-surface text-text-muted text-xs font-mono">
                  Drag
                </kbd>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Pan</span>
                <div className="flex gap-1">
                  <kbd className="px-2 py-1 rounded bg-surface text-text-muted text-xs font-mono">
                    Shift
                  </kbd>
                  <span className="text-text-muted">+</span>
                  <kbd className="px-2 py-1 rounded bg-surface text-text-muted text-xs font-mono">
                    Drag
                  </kbd>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Zoom</span>
                <kbd className="px-2 py-1 rounded bg-surface text-text-muted text-xs font-mono">
                  Scroll
                </kbd>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">
              Keyboard
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Pan</span>
                <kbd className="px-2 py-1 rounded bg-surface text-text-muted text-xs font-mono">
                  Arrow keys
                </kbd>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Show shortcuts</span>
                <kbd className="px-2 py-1 rounded bg-surface text-text-muted text-xs font-mono">
                  ?
                </kbd>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Close dialogs</span>
                <kbd className="px-2 py-1 rounded bg-surface text-text-muted text-xs font-mono">
                  Esc
                </kbd>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-3">
              Touch Gestures
            </h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Orbit</span>
                <span className="text-text-muted text-xs">One finger drag</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Zoom</span>
                <span className="text-text-muted text-xs">Pinch</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Pan</span>
                <span className="text-text-muted text-xs">Two finger drag</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Fit to view</span>
                <span className="text-text-muted text-xs">Double tap</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Reset view</span>
                <span className="text-text-muted text-xs">Two finger tap</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
