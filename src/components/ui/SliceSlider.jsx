import React from "react";
import { shallow } from "zustand/shallow";
import { useViewerStore } from "../../stores/viewerStore.js";

export function SliceSlider() {
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

  return (
    <div className="fixed right-3 top-1/2 z-40 flex -translate-y-1/2 flex-col items-center">
      <div className="flex flex-col items-center gap-2 rounded-2xl bg-slate-900/90 px-2 py-3 shadow-xl ring-1 ring-white/10 backdrop-blur-sm">
        <button
          type="button"
          onClick={handleToggle}
          className={`rounded-lg px-1.5 py-2 text-[0.55rem] font-semibold uppercase tracking-widest transition ${
            sliceViewActive
              ? "bg-cyan-500 text-white shadow-lg shadow-cyan-500/30"
              : "bg-white/10 text-white/70 hover:bg-white/20 hover:text-white"
          }`}
          style={{ writingMode: "vertical-rl" }}
          title={sliceViewActive ? "Hide slices" : "Show slices"}
        >
          Slice
        </button>

        {sliceViewActive && (
          <>
            <span className="text-[0.55rem] font-medium tabular-nums text-white/60">
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
                className="slice-slider-vertical h-40 w-1.5 cursor-pointer appearance-none rounded-full bg-white/20"
                style={{
                  writingMode: "vertical-lr",
                  direction: "rtl",
                }}
                aria-label="Slice index"
              />
            </div>

            <span className="text-[0.55rem] font-medium tabular-nums text-white/60">
              {sliceMax}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
