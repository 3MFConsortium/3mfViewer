import React from "react";
import { shallow } from "zustand/shallow";
import { useViewerStore } from "../../stores/viewerStore.js";

export function SliceSlider({ position = "side" }) {
  const sliceStacksRaw = useViewerStore(
    (state) => state.viewer.sceneData?.sliceStacks,
    shallow
  );
  const sliceIndex = useViewerStore((state) => state.prefs.sliceIndex);
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

  const handleToggle = () => {
    setPrefs((prefs) => ({
      ...prefs,
      sliceIndex: prefs.sliceIndex >= 0 ? -1 : 0,
    }));
  };

  const handleSliderChange = (e) => {
    setPrefs((prefs) => ({ ...prefs, sliceIndex: Number(e.target.value) }));
  };

  if (sliceMax < 0) return null;

  if (position === "bottom") {
    return (
      <div className="fixed inset-x-3 bottom-3 z-40 flex justify-center">
        <div className="flex w-full max-w-[min(90vw,360px)] items-center gap-3 rounded-2xl glass-elevated px-3 py-2 shadow-xl">
          <button
            type="button"
            onClick={handleToggle}
            className={`rounded-full px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.3em] transition ${
              sliceViewActive
                ? "bg-accent text-accent-foreground shadow-lg shadow-accent/30"
                : "bg-surface-elevated/20 text-text-secondary hover:bg-surface-elevated/40 hover:text-text-primary"
            }`}
            title={sliceViewActive ? "Hide slices" : "Show slices"}
          >
            Slice
          </button>
          {sliceViewActive ? (
            <>
              <span className="text-[0.6rem] font-medium tabular-nums text-text-muted">
                {currentSlice}
              </span>
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
              <span className="text-[0.6rem] font-medium tabular-nums text-text-muted">
                {sliceMax}
              </span>
            </>
          ) : (
            <span className="text-[0.65rem] text-text-muted">Layers</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed right-3 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center">
      <div className="flex flex-col items-center gap-2 rounded-2xl glass-elevated px-2 py-3 shadow-xl">
        <button
          type="button"
          onClick={handleToggle}
          className={`rounded-lg px-1.5 py-2 text-[0.55rem] font-semibold uppercase tracking-widest transition ${
            sliceViewActive
              ? "bg-accent text-accent-foreground shadow-lg shadow-accent/30"
              : "bg-surface-elevated/20 text-text-secondary hover:bg-surface-elevated/40 hover:text-text-primary"
          }`}
          style={{ writingMode: "vertical-rl" }}
          title={sliceViewActive ? "Hide slices" : "Show slices"}
        >
          Slice
        </button>

        {sliceViewActive && (
          <>
            <span className="text-[0.55rem] font-medium tabular-nums text-text-muted">
              {currentSlice}
            </span>

            <div className="relative flex h-44 w-6 items-center justify-center">
              <input
                type="range"
                min="0"
                max={sliceMax}
                step="1"
                value={currentSlice}
                onChange={handleSliderChange}
                className="slice-slider-vertical h-40 w-1.5 cursor-pointer appearance-none rounded-full"
                style={{
                  writingMode: "vertical-lr",
                  direction: "rtl",
                }}
                aria-label="Slice index"
              />
            </div>

            <span className="text-[0.55rem] font-medium tabular-nums text-text-muted">
              {sliceMax}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
