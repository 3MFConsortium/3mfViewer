import React from "react";
import { shallow } from "zustand/shallow";
import { useViewerStore } from "../../stores/viewerStore.js";

const sliceModes = [
  { id: "off", label: "Model" },
  { id: "layer", label: "Layer" },
  { id: "stack", label: "Stack" },
];

function SliceModeSelector({ mode, onChange }) {
  return (
    <div className="grid grid-cols-3 gap-0.5 rounded-xl border border-border/70 bg-surface-elevated/20 p-1">
      {sliceModes.map((option) => {
        const active = mode === option.id;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={`rounded-lg px-1.5 py-1.5 text-[0.6rem] font-medium transition ${
              active
                ? "bg-surface-elevated text-text-primary shadow-sm ring-1 ring-border"
                : "text-text-muted hover:bg-surface-elevated/40 hover:text-text-primary"
            }`}
            aria-pressed={active}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function SliceSlider({ position = "side" }) {
  const sliceStacksRaw = useViewerStore(
    (state) => state.viewer.sceneData?.sliceStacks,
    shallow
  );
  const sliceIndex = useViewerStore((state) => state.prefs.sliceIndex);
  const sliceOverview = useViewerStore((state) => state.prefs.sliceOverview !== false);
  const setPrefs = useViewerStore((state) => state.setPrefs);

  const sliceStacks = React.useMemo(
    () => (Array.isArray(sliceStacksRaw) ? sliceStacksRaw : []),
    [sliceStacksRaw]
  );

  const sliceMax = React.useMemo(() => {
    if (!sliceStacks.length) return -1;
    const max = sliceStacks.reduce((acc, stack) => {
      const count = Number(stack?.sliceCount ?? 0);
      return Number.isFinite(count) ? Math.max(acc, count) : acc;
    }, 0);
    return max > 0 ? max - 1 : -1;
  }, [sliceStacks]);

  const sliceViewActive = sliceIndex >= 0;
  const currentSlice = sliceViewActive
    ? Math.min(Math.max(sliceIndex, 0), sliceMax)
    : 0;
  const activeMode = !sliceViewActive ? "off" : sliceOverview ? "stack" : "layer";

  const handleModeChange = (mode) => {
    setPrefs((prefs) => ({
      ...prefs,
      sliceIndex: mode === "off"
        ? -1
        : prefs.sliceIndex >= 0
          ? prefs.sliceIndex
          : Math.floor(sliceMax / 2),
      sliceOverview: mode === "stack",
    }));
  };

  const handleSliderChange = (e) => {
    setPrefs((prefs) => ({ ...prefs, sliceIndex: Number(e.target.value) }));
  };

  if (sliceMax < 0) return null;

  if (position === "bottom") {
    return (
      <div className="fixed inset-x-3 bottom-3 z-40 flex justify-center">
        <div className="flex w-full max-w-[min(94vw,520px)] items-center gap-3 rounded-2xl glass-elevated px-3 py-2.5 shadow-xl">
          <SliceModeSelector mode={activeMode} onChange={handleModeChange} />
          {sliceViewActive ? (
            <>
              <input
                type="range"
                min="0"
                max={sliceMax}
                step="1"
                value={currentSlice}
                onChange={handleSliderChange}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border/30"
                aria-label="Slice index"
              />
              <span className="min-w-14 text-right text-[0.65rem] font-medium tabular-nums text-text-secondary">
                {currentSlice} / {sliceMax}
              </span>
            </>
          ) : (
            <span className="text-[0.65rem] text-text-muted">Choose a slice display mode</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed right-3 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center">
      <div className="flex w-36 flex-col items-center gap-2.5 rounded-2xl glass-elevated px-2.5 py-3 shadow-xl">
        <div className="w-full">
          <div className="mb-1.5 text-center text-[0.6rem] font-medium text-text-secondary">
            Slice view
          </div>
          <SliceModeSelector mode={activeMode} onChange={handleModeChange} />
        </div>

        {sliceViewActive && (
          <>
            <span className="rounded-full border border-border/70 bg-surface-elevated/30 px-2 py-0.5 text-[0.6rem] font-medium tabular-nums text-text-secondary">
              {currentSlice} / {sliceMax}
            </span>

            <div className="relative flex h-48 w-8 items-center justify-center">
              <input
                type="range"
                min="0"
                max={sliceMax}
                step="1"
                value={currentSlice}
                onChange={handleSliderChange}
                className="slice-slider-vertical h-44 w-1.5 cursor-pointer appearance-none rounded-full"
                style={{
                  writingMode: "vertical-lr",
                  direction: "rtl",
                }}
                aria-label="Slice index"
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
