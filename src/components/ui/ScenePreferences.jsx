import React from "react";

import { useViewerStore } from "../../stores/viewerStore.js";
import { useTheme } from "../../contexts/ThemeContext.jsx";
import { IconSun, IconMoon, IconMonitor } from "./Icons.jsx";

const tabs = [
  { id: "appearance", label: "Appearance" },
  { id: "lighting", label: "Lighting & Helpers" },
  { id: "rendering", label: "Rendering" },
  { id: "interface", label: "Interface" },
];

const themeOptions = [
  { id: "light", label: "Light", icon: IconSun },
  { id: "dark", label: "Dark", icon: IconMoon },
  { id: "auto", label: "System", icon: IconMonitor },
];

export function ScenePreferences({ prefs, onChange }) {
  const activeTab = useViewerStore((state) => state.ui.scenePrefsActiveTab);
  const setActiveTab = useViewerStore((state) => state.setScenePrefsActiveTab);
  const sliceStacks = useViewerStore((state) => state.viewer.sceneData?.sliceStacks ?? []);
  const { theme, setTheme } = useTheme();
  const set = (key, value) => onChange({ ...prefs, [key]: value });
  const sliceMax = React.useMemo(() => {
    if (!sliceStacks.length) return -1;
    const max = sliceStacks.reduce((acc, stack) => {
      const count = Number(stack?.sliceCount ?? 0);
      return Number.isFinite(count) ? Math.max(acc, count) : acc;
    }, 0);
    return max > 0 ? max - 1 : -1;
  }, [sliceStacks]);
  const sliceViewEnabled = prefs.sliceIndex >= 0;

  const renderTabContent = () => {
    switch (activeTab) {
      case "appearance":
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-center gap-3">
              <span className="w-40 text-sm text-text-secondary">Background color</span>
              <input
                type="color"
                value={prefs.background}
                onChange={(e) => set("background", e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-border"
              />
            </label>
          </div>
        );
      case "lighting":
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-center gap-3">
              <span className="w-40 text-sm text-text-secondary">Ambient intensity</span>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={prefs.ambient}
                onChange={(e) => set("ambient", +e.target.value)}
                className="w-44 accent-accent"
              />
              <span className="text-xs tabular-nums w-10 text-text-muted">{prefs.ambient.toFixed(2)}</span>
            </label>
            <label className="flex items-center gap-3">
              <span className="w-40 text-sm text-text-secondary">Hemisphere intensity</span>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={prefs.hemiIntensity}
                onChange={(e) => set("hemiIntensity", +e.target.value)}
                className="w-44 accent-accent"
              />
              <span className="text-xs tabular-nums w-10 text-text-muted">{prefs.hemiIntensity.toFixed(2)}</span>
            </label>
            <label className="flex items-center gap-3">
              <span className="w-40 text-sm text-text-secondary">Hemisphere sky</span>
              <input
                type="color"
                value={prefs.hemiSkyColor}
                onChange={(e) => set("hemiSkyColor", e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-border"
              />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-40 text-sm text-text-secondary">Hemisphere ground</span>
              <input
                type="color"
                value={prefs.hemiGroundColor}
                onChange={(e) => set("hemiGroundColor", e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-border"
              />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-40 text-sm text-text-secondary">Rim intensity</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={prefs.rimIntensity}
                onChange={(e) => set("rimIntensity", +e.target.value)}
                className="w-44 accent-accent"
              />
              <span className="text-xs tabular-nums w-10 text-text-muted">{prefs.rimIntensity.toFixed(2)}</span>
            </label>
            <label className="flex items-center gap-3">
              <span className="w-40 text-sm text-text-secondary">Rim color</span>
              <input
                type="color"
                value={prefs.rimColor}
                onChange={(e) => set("rimColor", e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-border"
              />
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={prefs.ground}
                onChange={(e) => set("ground", e.target.checked)}
                className="accent-accent"
              />
              <span className="text-sm text-text-primary">Ground plane</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={prefs.grid}
                onChange={(e) => set("grid", e.target.checked)}
                className="accent-accent"
              />
              <span className="text-sm text-text-primary">Grid helper</span>
            </label>
          </div>
        );
      case "rendering":
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={prefs.wireframe}
                onChange={(e) =>
                  onChange({
                    ...prefs,
                    wireframe: e.target.checked,
                    edges: e.target.checked ? false : prefs.edges,
                  })
                }
                className="accent-accent"
              />
              <span className="text-sm text-text-primary">Wireframe</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={prefs.edges}
                onChange={(e) =>
                  onChange({
                    ...prefs,
                    edges: e.target.checked,
                    wireframe: e.target.checked ? false : prefs.wireframe,
                  })
                }
                className="accent-accent"
              />
              <span className="text-sm text-text-primary">Edge overlay</span>
            </label>
            <label className="flex items-center gap-3">
              <span className="w-40 text-sm text-text-secondary">Edge color</span>
              <input
                type="color"
                value={prefs.edgeColor}
                onChange={(e) => set("edgeColor", e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-border"
              />
            </label>
            <label className="flex items-center gap-3 sm:col-span-2">
              <span className="w-40 text-sm text-text-secondary">Beam lattices</span>
              <select
                value={prefs.beamLatticeMode}
                onChange={(e) => set("beamLatticeMode", e.target.value)}
                className="h-9 w-48 rounded-full border border-border bg-white px-3 text-sm text-text-primary shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value="lines">Lines only (fast)</option>
                <option value="hybrid">Hybrid (lines + mesh)</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={prefs.showStats}
                onChange={(e) => set("showStats", e.target.checked)}
                className="accent-accent"
              />
              <span className="text-sm text-text-primary">Show stats overlay</span>
            </label>
            {sliceMax >= 0 && (
              <>
                <label className="flex items-center gap-2 sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={sliceViewEnabled}
                    onChange={(e) =>
                      set("sliceIndex", e.target.checked ? 0 : -1)
                    }
                    className="accent-accent"
                  />
                  <span className="text-sm text-text-primary">Enable slice view</span>
                </label>
                <label className="flex items-center gap-3 sm:col-span-2">
                  <span className="w-40 text-sm text-text-secondary">Slice index</span>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(sliceMax, 0)}
                    step="1"
                    disabled={!sliceViewEnabled}
                    value={sliceViewEnabled ? Math.min(Math.max(prefs.sliceIndex, 0), sliceMax) : 0}
                    onChange={(e) => set("sliceIndex", Number(e.target.value))}
                    className="w-64 accent-accent"
                  />
                  <span className="text-xs tabular-nums w-16 text-right text-text-muted">
                    {sliceViewEnabled ? `${Math.min(Math.max(prefs.sliceIndex, 0), sliceMax)} / ${sliceMax}` : "Off"}
                  </span>
                </label>
              </>
            )}
          </div>
        );
      case "interface":
        return (
          <div className="space-y-6">
            {/* Theme Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-text-primary">Theme</h4>
              <div className="flex flex-wrap gap-2">
                {themeOptions.map((option) => {
                  const Icon = option.icon;
                  const isActive = theme === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setTheme(option.id)}
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition border ${
                        isActive
                          ? "bg-accent text-accent-foreground border-accent shadow"
                          : "bg-surface-elevated text-text-secondary border-border hover:border-accent/50 hover:text-text-primary"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <label className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  checked={prefs.syncWithTheme}
                  onChange={(e) => set("syncWithTheme", e.target.checked)}
                  className="accent-accent"
                />
                <span className="text-sm text-text-secondary">Sync scene colors with theme</span>
              </label>
            </div>

            {/* UI Elements Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-text-primary">UI Elements</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={prefs.uiSceneTree}
                    onChange={(e) => set("uiSceneTree", e.target.checked)}
                    className="accent-accent"
                  />
                  <span className="text-sm text-text-primary">Scene tree panel</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={prefs.uiBottomControls}
                    onChange={(e) => set("uiBottomControls", e.target.checked)}
                    className="accent-accent"
                  />
                  <span className="text-sm text-text-primary">Bottom toolbar</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={prefs.uiHelperMessage}
                    onChange={(e) => set("uiHelperMessage", e.target.checked)}
                    className="accent-accent"
                  />
                  <span className="text-sm text-text-primary">Helper tips banner</span>
                </label>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-center gap-2 text-sm sm:justify-start">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-full px-4 py-1.5 font-medium transition border ${
              activeTab === tab.id
                ? "bg-accent text-accent-foreground border-accent shadow"
                : "bg-surface-elevated text-text-secondary border-border hover:border-accent/50 hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {renderTabContent()}
      </div>
    </div>
  );
}
