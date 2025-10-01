import React, { useEffect } from "react";
import { IconClose } from "./Icons.jsx";

const SIZE_MAP = {
  sm: "max-w-lg",
  md: "max-w-3xl",
  lg: "max-w-4xl",
  xl: "max-w-5xl",
};

export function Modal({ open, title, subtitle, onClose, children, footer, size = "md" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const widthClass = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center px-3 py-10 sm:px-6">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`relative w-full ${widthClass} overflow-hidden rounded-3xl bg-white/95 shadow-xl ring-1 ring-slate-200 backdrop-blur`}
      >
        <div className="relative border-b border-slate-200 bg-white/95 px-6 py-5">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h3 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h3>
              {subtitle ? (
                <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-700"
            >
              <IconClose />
            </button>
          </div>
        </div>
        <div className="max-h-[72vh] overflow-y-auto bg-white/95 px-6 py-6 text-slate-700">{children}</div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white/95 px-6 py-4">
          {footer}
          <button
            onClick={onClose}
            className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
