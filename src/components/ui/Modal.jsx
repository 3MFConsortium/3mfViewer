import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { IconClose } from "./Icons.jsx";

const SIZE_MAP = {
  sm: "max-w-lg",
  md: "max-w-3xl",
  lg: "max-w-4xl",
  xl: "max-w-5xl",
};

export function Modal({ open, title, subtitle, onClose, children, footer, size = "md" }) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const titleId = useId();
  const subtitleId = useId();

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        last.focus();
        event.preventDefault();
      } else if (!event.shiftKey && document.activeElement === last) {
        first.focus();
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const widthClass = SIZE_MAP[size] || SIZE_MAP.md;

  // Use portal to render at document body level, escaping any parent stacking context
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center px-3 py-10 sm:px-6">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={subtitle ? subtitleId : undefined}
        className={`relative w-full ${widthClass} overflow-hidden rounded-3xl glass-elevated shadow-xl`}
      >
        <div className="relative border-b border-border bg-surface-elevated/95 px-6 py-5 backdrop-blur">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h3 id={titleId} className="text-lg font-semibold tracking-tight text-text-primary">{title}</h3>
              {subtitle ? (
                <p id={subtitleId} className="mt-1 text-sm text-text-muted">{subtitle}</p>
              ) : null}
            </div>
            <button
              type="button"
              ref={closeButtonRef}
              onClick={onClose}
              aria-label="Close dialog"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-elevated text-text-muted transition hover:border-accent/50 hover:bg-surface hover:text-text-secondary"
            >
              <IconClose />
            </button>
          </div>
        </div>
        <div className="max-h-[72vh] overflow-y-auto bg-surface-elevated/95 px-6 py-6 text-text-secondary backdrop-blur">{children}</div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border bg-surface-elevated/95 px-6 py-4 backdrop-blur">
          {footer}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow transition hover:bg-accent-hover"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
