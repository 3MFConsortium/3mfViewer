import React from "react";

import { IconUpload } from "../ui/Icons.jsx";

export function ViewerDropOverlay({ active }) {
  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[70] flex items-center justify-center p-5 transition-[opacity,visibility] duration-150 ${
        active ? "visible opacity-100" : "invisible opacity-0"
      }`}
      role="status"
      aria-live="polite"
      aria-hidden={!active}
    >
      <div className="absolute inset-0 bg-zinc-900/15 backdrop-blur-[3px]" />
      <div
        className={`relative w-full max-w-sm rounded-[1.75rem] border border-white/80 bg-white/94 p-3 shadow-[0_24px_70px_rgba(15,23,42,0.18)] transition-transform duration-150 ${
          active ? "scale-100" : "scale-[0.98]"
        }`}
      >
        <div className="flex min-h-56 flex-col items-center justify-center rounded-[1.35rem] border border-dashed border-zinc-300 bg-zinc-50/90 px-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-700 shadow-sm">
            <IconUpload className="h-7 w-7" />
          </div>
          <p className="mt-5 text-lg font-semibold tracking-[-0.02em] text-zinc-900">
            Drop your 3MF file
          </p>
          <p className="mt-1.5 text-sm leading-5 text-zinc-500">
            Release anywhere to open it in the viewer.
          </p>
          <span className="mt-5 rounded-full border border-zinc-200 bg-white px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            .3mf
          </span>
        </div>
      </div>
    </div>
  );
}
