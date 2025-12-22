import React from "react";

import { useViewerStore } from "../../stores/viewerStore.js";

const tabs = [
  { id: "appearance", label: "Appearance" },
  { id: "lighting", label: "Lighting & Helpers" },
  { id: "rendering", label: "Rendering" },
  { id: "interface", label: "Interface" },
];

export function ScenePreferences({ prefs, onChange }) {
  const activeTab = useViewerStore((state) => state.ui.scenePrefsActiveTab);
  const setActiveTab = useViewerStore((state) => state.setScenePrefsActiveTab);
  const set = (key, value) => onChange({ ...prefs, [key]: value });

  const renderTabContent = () => {
    switch (activeTab) {
      case "appearance":
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-center gap-3">
              <span className="w-40 text-sm text-slate-600">Background color</span>
              <input
                type="color"
                value={prefs.background}
                onChange={(e) => set("background", e.target.value)}
                className="h-9 w-12 cursor-pointer"
              />
            </label>
            <label className="flex items-center gap-3">
              <span className="w-40 text-sm text-slate-600">Directional light color</span>
              <input
                type="color"
                value={prefs.dirColor}
                onChange={(e) => set("dirColor", e.target.value)}
                className="h-9 w-12 cursor-pointer"
              />
            </label>
          </div>
        );
      case "lighting":
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-center gap-3">
              <span className="w-40 text-sm text-slate-600">Ambient intensity</span>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={prefs.ambient}
                onChange={(e) => set("ambient", +e.target.value)}
                className="w-44"
              />
              <span className="text-xs tabular-nums w-10">{prefs.ambient.toFixed(2)}</span>
            </label>

            <label className="flex items-center gap-3">
              <span className="w-40 text-sm text-slate-600">Directional intensity</span>
              <input
                type="range"
                min="0"
                max="3"
                step="0.05"
                value={prefs.directional}
                onChange={(e) => set("directional", +e.target.value)}
                className="w-44"
              />
              <span className="text-xs tabular-nums w-10">{prefs.directional.toFixed(2)}</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={prefs.shadows}
                onChange={(e) => set("shadows", e.target.checked)}
              />
              <span className="text-sm text-slate-700">Shadows</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={prefs.ground}
                onChange={(e) => set("ground", e.target.checked)}
              />
              <span className="text-sm text-slate-700">Ground plane</span>
            </label>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={prefs.grid}
                onChange={(e) => set("grid", e.target.checked)}
              />
              <span className="text-sm text-slate-700">Grid helper</span>
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
                onChange={(e) => set("wireframe", e.target.checked)}
              />
              <span className="text-sm text-slate-700">Wireframe</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={prefs.edges}
                onChange={(e) => set("edges", e.target.checked)}
              />
              <span className="text-sm text-slate-700">Edge overlay</span>
            </label>
            <label className="flex items-center gap-3">
              <span className="w-40 text-sm text-slate-600">Edge color</span>
              <input
                type="color"
                value={prefs.edgeColor}
                onChange={(e) => set("edgeColor", e.target.value)}
                className="h-9 w-12 cursor-pointer"
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={prefs.showStats}
                onChange={(e) => set("showStats", e.target.checked)}
              />
              <span className="text-sm text-slate-700">Show stats overlay</span>
            </label>
          </div>
        );
      case "interface":
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={prefs.uiSceneTree}
                onChange={(e) => set("uiSceneTree", e.target.checked)}
              />
              <span className="text-sm text-slate-700">Scene tree panel</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={prefs.uiBottomControls}
                onChange={(e) => set("uiBottomControls", e.target.checked)}
              />
              <span className="text-sm text-slate-700">Bottom toolbar</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={prefs.uiHelperMessage}
                onChange={(e) => set("uiHelperMessage", e.target.checked)}
              />
              <span className="text-sm text-slate-700">Helper tips banner</span>
            </label>
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
                ? "bg-slate-900 text-white border-slate-900 shadow"
                : "bg-white/90 text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-800"
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
