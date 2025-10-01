import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  IconCaret,
  IconCube,
  IconGroup,
  IconGeometry,
  IconMaterial,
  IconScalar,
  IconLight,
  IconClose,
  IconUpload,
  IconExport,
  IconValidate,
  IconVisible,
  IconHidden,
  IconHelp,
} from "./Icons.jsx";
import { Modal } from "./Modal.jsx";

const ICONS = {
  mesh: <IconCube />,
  light: <IconLight />,
  group: <IconGroup />,
  geometry: <IconGeometry />,
  material: <IconMaterial />,
  scalar: <IconScalar />,
};

const clamp01 = (value) => {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
};

const colorToCss = (color) => {
  if (!color) return null;
  const r = Math.round(clamp01(color.r ?? 0) * 255);
  const g = Math.round(clamp01(color.g ?? 0) * 255);
  const b = Math.round(clamp01(color.b ?? 0) * 255);
  const alpha = clamp01(color.a ?? 1);
  const alphaLabel = alpha === 1 ? "1" : alpha.toFixed(2);
  return `rgba(${r}, ${g}, ${b}, ${alphaLabel})`;
};

const colorToLabel = (color) => {
  if (!color) return "";
  const r = Math.round(clamp01(color.r ?? 0) * 255);
  const g = Math.round(clamp01(color.g ?? 0) * 255);
  const b = Math.round(clamp01(color.b ?? 0) * 255);
  const alpha = clamp01(color.a ?? 1);
  const hex = `#${[r, g, b]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
  return alpha === 1 ? hex : `${hex} @ ${alpha.toFixed(2)}`;
};

const formatMatrix4x3 = (matrix) => {
  if (!Array.isArray(matrix)) return "";
  return matrix
    .map((row) =>
      row
        .map((value) =>
          Number.isFinite(value) ? value.toFixed(Math.abs(value) >= 100 ? 1 : 3) : "--"
        )
        .join("  ")
    )
    .join("\n");
};

function TreeNode({
  node,
  onSelect,
  selectedId,
  onToggleVisibility,
  hiddenMeshIds,
}) {
  const [isOpen, setIsOpen] = useState(node.isOpenByDefault || false);
  const hasChildren = node.children && node.children.length > 0;
  const isMesh = node.type === "mesh";
  const hidden = isMesh ? hiddenMeshIds.includes(node.id) : false;
  const isSelected = selectedId === node.id;
  const tooltipLines = [node.name];
  if (node.meta?.resourceId !== undefined) tooltipLines.push(`Resource ID: ${node.meta.resourceId}`);
  if (node.meta?.uniqueResourceId !== undefined) tooltipLines.push(`Unique ID: ${node.meta.uniqueResourceId}`);
  if (node.meta?.uuid) tooltipLines.push(`UUID: ${node.meta.uuid}`);
  const materialRefs = (() => {
    if (Array.isArray(node.meta?.materialColorStats?.referencedResourceIds)) {
      return node.meta.materialColorStats.referencedResourceIds;
    }
    if (Array.isArray(node.meta?.materialResourceIds)) {
      return node.meta.materialResourceIds;
    }
    return [];
  })();
  const materialLabels = materialRefs
    .map((value) => (value === null || value === undefined ? "None" : String(value)))
    .filter((value, index, array) => value !== "None" && array.indexOf(value) === index);
  if (materialLabels.length) {
    tooltipLines.push(`Material groups: ${materialLabels.join(", ")}`);
  }
  const tooltip = tooltipLines.join("\n");

  const handleSelect = () => {
    onSelect?.(node);
    if (hasChildren) setIsOpen((prev) => !prev);
  };

  return (
    <li>
      <div
        onClick={handleSelect}
        className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 transition ${
          hasChildren ? "cursor-pointer" : "cursor-default"
        } ${isSelected ? "bg-slate-100 ring-1 ring-slate-200" : "hover:bg-slate-100/70"}`}
        title={tooltip}
      >
        <span className="w-5 text-center text-slate-500">
          {hasChildren ? <IconCaret open={isOpen} /> : null}
        </span>
        <span className="w-5 text-center text-slate-500">{ICONS[node.type] || "•"}</span>
        <span className="text-sm truncate" title={tooltip}>
          {node.name}
        </span>
        {isMesh && (
          <button
            type="button"
            aria-label={hidden ? "Show mesh" : "Hide mesh"}
            className={`ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-600 transition hover:bg-white ${
              hidden ? "opacity-70" : ""
            }`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleVisibility?.(node.id);
            }}
          >
            {hidden ? <IconHidden /> : <IconVisible />}
          </button>
        )}
      </div>
      {hasChildren && isOpen && (
        <ul className="pl-6 border-l border-slate-200 ml-4">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              onSelect={onSelect}
              selectedId={selectedId}
              onToggleVisibility={onToggleVisibility}
              hiddenMeshIds={hiddenMeshIds}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function SceneTree({
  items,
  onSelectFile,
  loadStatus = "idle",
  fileName = "",
  errorMessage = "",
  metadata = null,
  variant = "panel",
  open = true,
  onClose = () => {},
  className = "",
  onSelectNode,
  selectedNodeId = null,
  selectedInfo = null,
  onToggleMeshVisibility,
  hiddenMeshIds = [],
  onUpdateSpecifications,
  specificationResults = null,
}) {
  const inputRef = useRef(null);
  const [modelInfoOpen, setModelInfoOpen] = useState(false);
  const [modelInfoTab, setModelInfoTab] = useState("summary");
  const [infoCollapsed, setInfoCollapsed] = useState(false);
  const [specModalOpen, setSpecModalOpen] = useState(false);
  const [specInputValue, setSpecInputValue] = useState(() => "");
  const [materialModalOpen, setMaterialModalOpen] = useState(false);

  const handleFileClick = () => inputRef.current?.click();
  const handleFileChange = (event) => {
    const file = event.target.files && event.target.files[0];
    if (file && onSelectFile) onSelectFile(file);
    // Allow selecting same file twice.
    event.target.value = "";
  };

  const renderStatus = () => {
    if (loadStatus === "loading") return <span className="text-xs text-amber-600">Loading {fileName || "3MF"}…</span>;
    if (loadStatus === "error") return <span className="text-xs text-rose-600">{errorMessage || "Failed to load file"}</span>;
    if (loadStatus === "ready" && fileName) {
      return (
        <span className="text-xs text-slate-500 truncate" title={fileName}>
          Loaded: {fileName}
        </span>
      );
    }
    return (
      <span className="text-xs text-slate-400">
        Drag & drop a .3mf anywhere or use “Load New Data”.
      </span>
    );
  };

  const diagnosticsSummary = metadata?.diagnostics || null;
  const derivedMetadataSpecs = Array.isArray(metadata?.specifications)
    ? metadata.specifications
    : metadata?.primarySpecification
    ? [metadata.primarySpecification]
    : metadata?.specification
    ? [metadata.specification]
    : [];
  const specifications = specificationResults?.length ? specificationResults : derivedMetadataSpecs;
  const [localSpecResults, setLocalSpecResults] = useState(specifications);
  const baseMaterialGroups = useMemo(() => {
    if (!Array.isArray(metadata?.baseMaterialGroups)) return [];
    return metadata.baseMaterialGroups;
  }, [metadata?.baseMaterialGroups]);

  const colorGroups = useMemo(() => {
    if (!Array.isArray(metadata?.colorGroups)) return [];
    return metadata.colorGroups;
  }, [metadata?.colorGroups]);
  const baseMaterialGroupMap = useMemo(() => {
    const map = new Map();
    baseMaterialGroups.forEach((group) => {
      if (!group) return;
      const keys = [group.groupId, group.uniqueResourceId].filter(
        (value) => value !== undefined && value !== null
      );
      keys.forEach((key) => map.set(String(key), group));
    });
    return map;
  }, [baseMaterialGroups]);

  const colorGroupMap = useMemo(() => {
    const map = new Map();
    colorGroups.forEach((group) => {
      if (!group) return;
      const keys = [group.groupId, group.uniqueResourceId].filter(
        (value) => value !== undefined && value !== null
      );
      keys.forEach((key) => map.set(String(key), group));
    });
    return map;
  }, [colorGroups]);
  const derivedWarningTotal =
    (diagnosticsSummary?.nonStrict?.warningCount ??
      diagnosticsSummary?.nonStrict?.warnings?.length ??
      0) +
    (diagnosticsSummary?.strict?.warningCount ??
      diagnosticsSummary?.strict?.warnings?.length ??
      0);
  const derivedErrorTotal =
    (diagnosticsSummary?.nonStrict?.errorCount ??
      diagnosticsSummary?.nonStrict?.errors?.length ??
      0) +
    (diagnosticsSummary?.strict?.errorCount ??
      diagnosticsSummary?.strict?.errors?.length ??
      0);
  const totalWarnings =
    typeof diagnosticsSummary?.totalWarnings === "number"
      ? diagnosticsSummary.totalWarnings
      : derivedWarningTotal;
  const totalErrors =
    typeof diagnosticsSummary?.totalErrors === "number"
      ? diagnosticsSummary.totalErrors
      : derivedErrorTotal;
  const totalIssues = totalWarnings + totalErrors;
  const hasDiagnosticsAttention = totalWarnings + totalErrors > 0;
  const isReady = loadStatus === "ready" && !!metadata;

  const groupedDiagnosticsByMode = useMemo(() => {
    if (!diagnosticsSummary) return [];
    return ["nonStrict", "strict"].map((mode) => {
      const modeData = diagnosticsSummary[mode] || {};
      return {
        mode,
        label: mode === "nonStrict" ? "Non-strict mode" : "Strict mode",
        warningGroups: Array.isArray(modeData.warningGroups) ? modeData.warningGroups : [],
        errorGroups: Array.isArray(modeData.errorGroups) ? modeData.errorGroups : [],
        warningCount: modeData.warningCount ?? modeData.warnings?.length ?? 0,
        errorCount: modeData.errorCount ?? modeData.errors?.length ?? 0,
      };
    });
  }, [diagnosticsSummary]);

  const severityStyles = {
    warning: {
      border: "border-amber-200",
      background: "bg-amber-50/80",
      text: "text-amber-800",
      badge: "bg-amber-100 text-amber-700",
    },
    error: {
      border: "border-rose-200",
      background: "bg-rose-50/80",
      text: "text-rose-800",
      badge: "bg-rose-100 text-rose-700",
    },
  };

  const handleOpenModelInfo = (view = "summary") => {
    if (!isReady) return;
    setModelInfoTab(view);
    setModelInfoOpen(true);
  };

  const summaryRows = isReady
    ? (() => {
        const rows = [];
        if (metadata.unit?.name) {
          const base = `${metadata.unit.name}${metadata.unit.symbol ? ` (${metadata.unit.symbol})` : ''}`;
          const meters = typeof metadata.unit.toMeters === "number" ? `1 unit = ${metadata.unit.toMeters} m` : null;
          rows.push({
            label: "Unit",
            value: meters ? `${base}\n${meters}` : base,
          });
        }
        if (metadata.modelUUID) {
          rows.push({ label: "Model UUID", value: metadata.modelUUID, mono: true });
        }
        if (metadata.lib3mfVersion) {
          rows.push({ label: "lib3mf", value: metadata.lib3mfVersion });
        }
        if (typeof metadata.counts?.buildItems === "number") {
          rows.push({ label: "Build items", value: metadata.counts.buildItems.toLocaleString(), numeric: true });
        }
        if (typeof metadata.counts?.meshes === "number") {
          rows.push({ label: "Mesh instances", value: metadata.counts.meshes.toLocaleString(), numeric: true });
        }
        if (typeof metadata.counts?.meshResources === "number") {
          rows.push({ label: "Unique mesh resources", value: metadata.counts.meshResources.toLocaleString(), numeric: true });
        }
        if (typeof metadata.counts?.components === "number") {
          rows.push({ label: "Component objects", value: metadata.counts.components.toLocaleString(), numeric: true });
        }
        return rows;
      })()
    : [];

  const summaryContent = isReady ? (
    <div className="space-y-6 text-xs text-slate-600">
      <section className="space-y-3">
        <div className="text-sm font-semibold text-slate-800">Model snapshot</div>
        <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <tbody className="bg-white">
              {summaryRows.map((row) => (
                <tr key={row.label} className="even:bg-slate-50/70">
                  <th className="w-1/3 px-4 py-3 text-left font-semibold text-slate-600">
                    {row.label}
                  </th>
                  <td className="px-4 py-3 text-right text-slate-800">
                    {row.mono ? (
                      <span className="font-mono text-[0.7rem] leading-snug break-all">{row.value}</span>
                    ) : (
                      <span className={row.numeric ? "tabular-nums" : ""}>
                        {typeof row.value === "string" && row.value.includes("\n")
                          ? row.value.split("\n").map((line, idx) => (
                              <span key={idx} className="block">
                                {line}
                              </span>
                            ))
                          : row.value || "—"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {baseMaterialGroups.length ? (
        <section className="space-y-2">
          <div className="text-sm font-semibold text-slate-800">Base material groups</div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {baseMaterialGroups.map((group) => (
              <li
                key={`bmat-${group.groupId ?? group.index}`}
                className="rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm"
              >
                <div className="flex justify-between text-[0.72rem] text-slate-500">
                  <span>Group {group.groupId ?? "?"}</span>
                  <span>
                    {group.materials?.length ?? 0} material
                    {(group.materials?.length ?? 0) === 1 ? "" : "s"}
                  </span>
                </div>
                {group.uuid ? (
                  <div className="mt-2 font-mono text-[0.68rem] leading-snug text-slate-500 break-all">
                    UUID: {group.uuid}
                  </div>
                ) : null}
                {Array.isArray(group.materials) && group.materials.length ? (
                  <ul className="mt-2 space-y-1">
                    {group.materials.map((mat) => (
                      <li
                        key={`bmat-${group.groupId}-${mat.propertyId}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-1"
                      >
                        <div className="flex flex-col">
                          <span className="truncate text-[0.72rem] text-slate-600">
                            {mat.name || `Material ${mat.propertyIndex ?? mat.propertyId}`}
                          </span>
                          <span className="text-[0.62rem] uppercase tracking-[0.18em] text-slate-400">
                            ID {mat.propertyId ?? '—'} · index {mat.propertyIndex ?? '—'}
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[0.7rem] text-slate-500">
                          <span
                            className="h-3 w-3 rounded"
                            style={{ backgroundColor: colorToCss(mat.color) || "transparent" }}
                          />
                          {colorToLabel(mat.color)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {colorGroups.length ? (
        <section className="space-y-2">
          <div className="text-sm font-semibold text-slate-800">Color groups</div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {colorGroups.map((group) => (
              <li
                key={`cgroup-${group.groupId ?? group.index}`}
                className="rounded-2xl border border-slate-200 bg-white/80 p-3 shadow-sm"
              >
                <div className="flex justify-between text-[0.72rem] text-slate-500">
                  <span>Group {group.groupId ?? "?"}</span>
                  <span>
                    {group.colors?.length ?? 0} color
                    {(group.colors?.length ?? 0) === 1 ? "" : "s"}
                  </span>
                </div>
                {group.uuid ? (
                  <div className="mt-2 font-mono text-[0.68rem] leading-snug text-slate-500 break-all">
                    UUID: {group.uuid}
                  </div>
                ) : null}
                {Array.isArray(group.colors) && group.colors.length ? (
                  <ul className="mt-2 space-y-1">
                    {group.colors.map((entry, idx) => (
                      <li
                        key={`cgroup-${group.groupId}-${entry.propertyId ?? idx}-${entry.propertyIndex ?? idx}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-2 py-1"
                      >
                        <div className="flex flex-col">
                          <span className="text-[0.72rem] text-slate-600">
                            {colorToLabel(entry.color)}
                          </span>
                          <span className="text-[0.62rem] uppercase tracking-[0.18em] text-slate-400">
                            ID {entry.propertyId ?? '—'} · index {entry.propertyIndex ?? idx}
                          </span>
                        </div>
                        <span
                          className="inline-block h-3 w-3 rounded"
                          style={{ backgroundColor: colorToCss(entry.color) || "transparent" }}
                        />
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  ) : null;

  let diagnosticsContent = null;
  if (isReady && diagnosticsSummary) {
    diagnosticsContent = (
      <div className="space-y-4 text-xs text-slate-600">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
            <div className="text-sm font-semibold text-slate-700">Warnings</div>
            <div className="mt-1 text-2xl font-semibold text-amber-600">{totalWarnings.toLocaleString()}</div>
            <p className="mt-2 text-[0.75rem] text-slate-500">
              Combined warnings from strict and non-strict parsing passes.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
            <div className="text-sm font-semibold text-slate-700">Errors</div>
            <div className="mt-1 text-2xl font-semibold text-rose-600">{totalErrors.toLocaleString()}</div>
            <p className="mt-2 text-[0.75rem] text-slate-500">
              Critical issues encountered while reading the package.
            </p>
          </div>
        </div>

        {groupedDiagnosticsByMode.map(({
          mode,
          label,
          warningGroups,
          errorGroups,
          warningCount,
          errorCount,
        }) => {
          const hasWarnings = warningCount > 0;
          const hasErrors = errorCount > 0;
          const groups = [...warningGroups, ...errorGroups];

          if (!hasWarnings && !hasErrors) {
            return (
              <section key={mode} className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-slate-700">{label}</div>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[0.7rem] font-medium text-emerald-600">
                    Clean
                  </span>
                </div>
                <p className="mt-2 text-[0.75rem] text-slate-500">No warnings or errors reported.</p>
              </section>
            );
          }

          return (
            <section key={mode} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-800">{label}</div>
                <div className="flex items-center gap-2 text-[0.7rem] text-slate-500">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">
                    {warningCount.toLocaleString()} warning{warningCount === 1 ? "" : "s"}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-rose-700">
                    {errorCount.toLocaleString()} error{errorCount === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {groups.map((group) => {
                  const style = severityStyles[group.severity] || severityStyles.warning;
                  const severityLabel = group.severity === "error" ? "Error" : "Warning";
                  return (
                    <div
                      key={`${group.mode}-${group.severity}-${group.message}-${group.code ?? "none"}`}
                      className={`rounded-xl border ${style.border} ${style.background} px-3 py-2 shadow-sm`}
                    >
                      <div className="flex items-center justify-between text-[0.68rem] font-semibold uppercase tracking-wide">
                        <span className={style.text}>
                          {severityLabel} · {label}
                        </span>
                        <span className={`${style.badge} inline-flex min-w-[2.5rem] justify-center rounded-full px-2 py-0.5 font-semibold`}>
                          ×{group.count.toLocaleString()}
                        </span>
                      </div>
                      <div className={`mt-1 text-[0.78rem] leading-relaxed ${style.text}`}>
                        {group.message || "(No message provided)"}
                      </div>
                      {group.code !== null && group.code !== undefined ? (
                        <div className={`mt-1 text-[0.68rem] font-medium ${style.text}`}>
                          Code {group.code}
                        </div>
                      ) : null}
                      {group.context ? (
                        <div className={`mt-1 text-[0.66rem] italic ${style.text}`}>{group.context}</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  const modelInfoContent = isReady
    ? (
        <div className="space-y-6 text-xs text-slate-600">
          <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1 text-[0.72rem] font-medium">
            {[
              { key: "summary", label: "Summary" },
          {
            key: "diagnostics",
            label: "Diagnostics",
            badge: totalIssues,
          },
            ].map((tab) => {
              const active = modelInfoTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setModelInfoTab(tab.key)}
                  className={`relative inline-flex items-center gap-2 rounded-full px-3 py-1.5 transition ${
                    active
                      ? "bg-white text-slate-900 shadow"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {tab.label}
                  {tab.badge ? (
                    <span
                      className={`inline-flex min-w-[1.5rem] justify-center rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${
                        tab.badge > 0 ? "bg-rose-100 text-rose-600" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          {modelInfoTab === "summary" ? summaryContent : diagnosticsContent}
        </div>
      )
    : null;

  useEffect(() => {
    if (variant !== "drawer" || !open) return undefined;

    const handleKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [variant, open, onClose]);

  useEffect(() => {
    if (loadStatus !== "ready") {
      setModelInfoOpen(false);
      setModelInfoTab("summary");
      setSpecModalOpen(false);
      setMaterialModalOpen(false);
    }
  }, [loadStatus]);

  useEffect(() => {
    if (specificationResults?.length) {
      const text = specificationResults.map((s) => s.url).filter(Boolean).join("\n");
      if (text.length) {
        setSpecInputValue(text);
        return;
      }
    }
  }, [
    specificationResults,
    metadata?.specifications,
    metadata?.primarySpecification?.url,
    metadata?.specification?.url,
  ]);

  useEffect(() => {
    setInfoCollapsed(false);
    setMaterialModalOpen(false);
  }, [selectedInfo?.id]);

  const sharedHeader = (
    <div
      className={`flex flex-col gap-3 px-5 pt-4 pb-3 shrink-0 border-b border-slate-200 ${
        variant === "drawer" ? "bg-white" : "bg-white/95"
      }`}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center justify-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept=".3mf"
            hidden
            onChange={handleFileChange}
          />
          <div className="flex w-full flex-wrap items-center justify-center gap-2 sm:flex-nowrap">
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-white shadow-sm transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 sm:h-9 sm:w-9"
              onClick={handleFileClick}
              title="Load new data"
              aria-label="Load new data"
            >
              <IconUpload />
            </button>
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-white/80 shadow-sm transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60 sm:h-9 sm:w-9"
              type="button"
              disabled
              title="Export 3MF (coming soon)"
              aria-label="Export 3MF"
            >
              <IconExport />
            </button>
            <button
              className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full shadow-sm transition sm:h-9 sm:w-9 ${
                !isReady
                  ? "cursor-not-allowed bg-slate-200 text-slate-400"
                  : hasDiagnosticsAttention
                  ? "bg-rose-600 text-white hover:bg-rose-700"
                  : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
              type="button"
              disabled={!isReady}
              title={isReady ? "Open validator" : "Validator available after loading"}
              aria-label="Open validator"
              onClick={() => handleOpenModelInfo("diagnostics")}
            >
              <IconValidate />
              {hasDiagnosticsAttention ? (
                <span className="absolute -top-1 -right-1 inline-flex min-w-[1.25rem] justify-center rounded-full bg-white/90 px-1 py-0.5 text-[0.65rem] font-semibold text-rose-600 shadow">
                  {Math.min(totalWarnings + totalErrors, 99)}
                </span>
              ) : null}
            </button>
            <button
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full shadow-sm transition sm:h-9 sm:w-9 ${
                !isReady
                  ? "cursor-not-allowed bg-slate-200 text-slate-400"
                  : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
              type="button"
              disabled={!isReady}
              title={isReady ? "Model info" : "Model info available after loading"}
              aria-label="Model info"
              onClick={() => handleOpenModelInfo("summary")}
            >
              <IconHelp />
            </button>
            <button
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full shadow-sm transition sm:h-9 sm:w-9 ${
                !isReady
                  ? "cursor-not-allowed bg-slate-200 text-slate-400"
                  : "bg-slate-900 text-white hover:bg-slate-800"
              }`}
              type="button"
              disabled={!isReady}
              title={isReady ? "Check specification URLs" : "Available after loading"}
              aria-label="Check specifications"
              onClick={() => {
                setSpecInputValue("");
                setSpecModalOpen(true);
              }}
            >
              <span className="text-[0.7rem] font-semibold tracking-wide">SPEC</span>
            </button>
            {variant === "drawer" && (
              <button
                type="button"
                aria-label="Close navigator"
                className="rounded-full border border-transparent bg-slate-100/80 p-2 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
                onClick={onClose}
              >
                <IconClose />
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 truncate text-center">{renderStatus()}</div>
      </div>
    </div>
  );

  const listSection = (
    <div className="flex-1 overflow-auto px-3 pb-3 pt-3">
      {items.length > 0 ? (
        <ul className="space-y-1">
          {items.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              onSelect={(payload) => {
                const sameNode = selectedNodeId === payload.id;
                onSelectNode?.({
                  id: payload.id,
                  name: payload.name,
                  type: payload.type,
                  meta: payload.meta || {},
                });
                if (sameNode) {
                  setInfoCollapsed((prev) => !prev);
                } else {
                  setInfoCollapsed(false);
                }
              }}
              selectedId={selectedNodeId}
              onToggleVisibility={onToggleMeshVisibility}
              hiddenMeshIds={hiddenMeshIds}
            />
          ))}
        </ul>
      ) : (
        <div className="text-xs text-slate-500 px-2 py-3">
          Drop a .3mf into the viewport or use the button above.
        </div>
      )}
    </div>
  );

  const modelInfoModal = modelInfoContent ? (
    <Modal
      open={modelInfoOpen}
      onClose={() => setModelInfoOpen(false)}
      title={fileName ? `Model info · ${fileName}` : "Model info"}
      subtitle="Detailed diagnostics and metadata extracted via lib3mf"
      size="xl"
    >
      {modelInfoContent}
    </Modal>
  ) : null;

  useEffect(() => {
    setLocalSpecResults(specifications);
  }, [specifications]);

  const handleSpecSave = async () => {
    if (!isReady) return;
    const urls = specInputValue
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    try {
      const result = await onUpdateSpecifications?.(urls);
      if (Array.isArray(result) && result.length) {
        setLocalSpecResults(result);
      } else {
        setLocalSpecResults(urls.map((url) => ({ url, supported: false, major: null, minor: null, micro: null })));
      }
    } catch {
      setLocalSpecResults(urls.map((url) => ({ url, supported: false, major: null, minor: null, micro: null })));
    }
  };

  const materialUsageDetails = useMemo(() => {
    if (!selectedInfo?.meta?.materialColorStats) return [];
    const groups = selectedInfo.meta.materialColorStats.groups || {};
    const entries = Object.entries(groups).map(([rawKey, groupInfo]) => {
      const resourceId = rawKey === "None" ? null : rawKey;
      const key = resourceId === null ? "None" : String(resourceId);
      const baseGroup = resourceId !== null ? baseMaterialGroupMap.get(String(resourceId)) : null;
      const colorGroup = resourceId !== null ? colorGroupMap.get(String(resourceId)) : null;
      const groupType = groupInfo.groupType || (baseGroup ? "BaseMaterialGroup" : colorGroup ? "ColorGroup" : "Other");
      const coloredIds = new Set(
        Array.isArray(groupInfo.propertyIdsWithColors)
          ? groupInfo.propertyIdsWithColors.map((pid) => String(pid))
          : []
      );
      const propertyIds = Array.isArray(groupInfo.propertyIds)
        ? Array.from(
            new Set(
              groupInfo.propertyIds.map((pid) =>
                Number.isFinite(Number(pid)) ? Number(pid) : String(pid)
              )
            )
          )
        : [];
      const properties = propertyIds.map((pid) => {
        const pidKey = String(pid);
        const matchEntry = (list) => {
          if (!Array.isArray(list)) return null;
          return list.find((entry) => {
            const idMatch = entry?.propertyId != null && String(entry.propertyId) === pidKey;
            const indexMatch = entry?.propertyIndex != null && String(entry.propertyIndex) === pidKey;
            return idMatch || indexMatch;
          });
        };

        const baseEntry = matchEntry(baseGroup?.materials);
        const colorEntry = matchEntry(colorGroup?.colors);
        const color = baseEntry?.color || colorEntry?.color || null;
        const friendlyName = baseEntry?.name || null;
        const hasColor = coloredIds.has(pidKey);
        const idLabelParts = [];
        if (baseEntry?.propertyId != null || colorEntry?.propertyId != null) {
          const pidVal = baseEntry?.propertyId ?? colorEntry?.propertyId;
          idLabelParts.push(`ID ${pidVal}`);
        }
        const indexVal = baseEntry?.propertyIndex ?? colorEntry?.propertyIndex;
        if (indexVal != null) {
          idLabelParts.push(`index ${indexVal}`);
        }
        const suffix = idLabelParts.length ? idLabelParts.join(' · ') : `ID ${pidKey}`;
        return {
          propertyId: pidKey,
          color,
          hasColor,
          label: friendlyName ? `${friendlyName} (${suffix})` : suffix,
        };
      });
      const uuid = baseGroup?.uuid || colorGroup?.uuid || null;
      const total = groupInfo.triangles ?? 0;
      const colored = groupInfo.withColors ?? 0;
      return {
        resourceKey: key,
        resourceId,
        groupType,
        label: resourceId === null ? "No material resource" : `Group ${key}`,
        uuid,
        triangles: total,
        withColors: colored,
        properties,
      };
    });
    entries.sort((a, b) => {
      if (a.resourceId === null) return 1;
      if (b.resourceId === null) return -1;
      const aNumber = Number(a.resourceId);
      const bNumber = Number(b.resourceId);
      if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
        return aNumber - bNumber;
      }
      return String(a.resourceKey).localeCompare(String(b.resourceKey));
    });
    return entries.filter((entry) => entry.triangles > 0);
  }, [selectedInfo, baseMaterialGroupMap, colorGroupMap]);

  const selectedMeta = selectedInfo?.meta || null;
  const hasMetadataEntries = Array.isArray(selectedMeta?.metadataEntries) && selectedMeta.metadataEntries.length > 0;
  const hasComponentsList = Array.isArray(selectedMeta?.components) && selectedMeta.components.length > 0;
  const hasTransformsList = Array.isArray(selectedMeta?.transforms) && selectedMeta.transforms.length > 0;
  const hasUuidInfo = Boolean(selectedMeta?.uuid || selectedMeta?.buildItemUuid || selectedMeta?.hasUUID !== undefined);
  const hasMaterialUsage = materialUsageDetails.length > 0;
  const modalHasContent = hasMaterialUsage || hasMetadataEntries || hasComponentsList || hasTransformsList || hasUuidInfo;

  useEffect(() => {
    if (!modalHasContent && materialModalOpen) {
      setMaterialModalOpen(false);
    }
  }, [modalHasContent, materialModalOpen]);

  const specModal = (
    <Modal
      open={specModalOpen}
      onClose={() => setSpecModalOpen(false)}
      title="Check 3MF Specifications"
      subtitle="Enter one URL per line to verify support"
      size="md"
      footer={
        <button
          type="button"
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-slate-800"
          onClick={handleSpecSave}
        >
          Check support
        </button>
      }
    >
      <textarea
        value={specInputValue}
        onChange={(event) => setSpecInputValue(event.target.value)}
        placeholder="https://example/specification1\nhttps://example/specification2"
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-inner focus:outline-none focus:ring-2 focus:ring-slate-400"
        rows={6}
      />
      {(localSpecResults?.length ?? 0) ? (
        <div className="mt-4 space-y-2 text-xs text-slate-600">
          <div className="font-semibold text-slate-700">Current results</div>
          <ul className="space-y-1">
            {localSpecResults.map((spec, index) => (
              <li
                key={`${spec.url || "spec"}-${index}`}
                className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[0.72rem] font-semibold text-slate-700 break-all">
                    {spec.url || `Specification ${index + 1}`}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] ${
                      spec.supported ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                    }`}
                  >
                    {spec.supported ? "Supported" : "Unsupported"}
                  </span>
                </div>
                {spec.major !== null && (
                  <div className="mt-1 text-[0.68rem] text-slate-500">
                    Version: v{[spec.major, spec.minor, spec.micro].filter((v) => v !== null).join('.')}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Modal>
  );

  const moreDetailsModal = modalHasContent ? (
    <Modal
      open={materialModalOpen}
      onClose={() => setMaterialModalOpen(false)}
      title="Additional details"
      subtitle="Deep-dive info resolved from lib3mf"
      size="lg"
    >
      <div className="space-y-4 text-xs text-slate-600">
        {hasUuidInfo ? (
          <section className="space-y-2">
            <header className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Identifiers
            </header>
            <ul className="space-y-1">
              {selectedMeta?.uuid ? (
                <li className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2">
                  <div className="text-[0.7rem] font-semibold text-slate-600">Resource UUID</div>
                  <div className="mt-1 break-all font-mono text-[0.66rem] leading-snug text-slate-500">
                    {selectedMeta.uuid}
                  </div>
                </li>
              ) : null}
              {selectedMeta?.buildItemUuid ? (
                <li className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2">
                  <div className="text-[0.7rem] font-semibold text-slate-600">Build item UUID</div>
                  <div className="mt-1 break-all font-mono text-[0.66rem] leading-snug text-slate-500">
                    {selectedMeta.buildItemUuid}
                  </div>
                </li>
              ) : null}
              {selectedMeta?.hasUUID !== undefined ? (
                <li className="rounded-xl border border-slate-200 bg-white/90 px-3 py-2">
                  <div className="text-[0.7rem] font-semibold text-slate-600">UUID present</div>
                  <div className="mt-1 text-[0.7rem] text-slate-700">
                    {selectedMeta.hasUUID ? "Yes" : "No"}
                  </div>
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}

        {hasMaterialUsage ? (
          <section className="space-y-2">
            <header className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Material usage
            </header>
            <div className="space-y-2">
              {materialUsageDetails.map((entry) => (
                <article
                  key={`material-modal-${entry.resourceKey}`}
                  className="rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm"
                >
                  <header className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[0.78rem] font-semibold text-slate-700">
                      {entry.label}
                    </div>
                    <div className="inline-flex items-center gap-2 text-[0.7rem] text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 uppercase tracking-[0.22em] text-[0.62rem] text-slate-600">
                        {(() => {
                          switch (entry.groupType) {
                            case "BaseMaterialGroup":
                              return "Base material";
                            case "ColorGroup":
                              return "Color";
                            case "Texture2DGroup":
                              return "Texture2D";
                            case "None":
                              return "None";
                            default:
                              return entry.groupType || "Unknown";
                          }
                        })()}
                      </span>
                      <span className="tabular-nums" title="Triangles referencing this group">
                        {entry.triangles.toLocaleString()} tri
                      </span>
                      <span className="tabular-nums" title="Triangles with resolved colors">
                        Colored {entry.withColors.toLocaleString()}
                      </span>
                    </div>
                  </header>
                  {entry.uuid ? (
                    <div className="mt-1 font-mono text-[0.66rem] leading-snug text-slate-500 break-all">
                      UUID: {entry.uuid}
                    </div>
                  ) : null}
                  {entry.properties.length ? (
                    <ul className="mt-3 space-y-1">
                      {entry.properties.map((prop) => (
                        <li
                          key={`material-modal-${entry.resourceKey}-prop-${prop.propertyId}`}
                          className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2"
                        >
                          <div className="truncate text-[0.72rem] text-slate-600" title={prop.label}>
                            {prop.label}
                          </div>
                          <div className="inline-flex items-center gap-2 text-[0.65rem] text-slate-500">
                            {prop.color ? (
                              <>
                                <span
                                  className="h-3 w-3 rounded"
                                  style={{ backgroundColor: colorToCss(prop.color) || "transparent" }}
                                />
                                <span>{colorToLabel(prop.color)}</span>
                              </>
                            ) : (
                              <span className={prop.hasColor ? "text-emerald-600" : "text-slate-400"}>
                                {prop.hasColor ? "Colored" : "No per-face color"}
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-3 text-[0.66rem] text-slate-400">No property IDs reported.</div>
                  )}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {hasMetadataEntries ? (
          <section className="space-y-2">
            <header className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Metadata entries
            </header>
            <ul className="space-y-1">
              {selectedMeta.metadataEntries.map((entry, index) => (
                <li
                  key={`${entry.key || entry.name || "meta"}-${index}`}
                  className="rounded-xl border border-slate-200 bg-white/90 p-2"
                >
                  <div className="text-[0.72rem] font-semibold text-slate-600">
                    {entry.key || entry.name || `Entry ${index + 1}`}
                  </div>
                  <div className="mt-0.5 break-words text-[0.8rem] text-slate-700">
                    {entry.value || "(empty)"}
                  </div>
                  {(entry.namespace || entry.type || entry.mustPreserve) && (
                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[0.68rem] text-slate-500">
                      {entry.namespace ? <span>NS: {entry.namespace}</span> : null}
                      {entry.type ? <span>Type: {entry.type}</span> : null}
                      {entry.mustPreserve ? <span className="font-semibold text-amber-600">Must preserve</span> : null}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {hasComponentsList ? (
          <section className="space-y-2">
            <header className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Components
            </header>
            <ul className="space-y-1">
              {selectedMeta.components.map((component) => (
                <li
                  key={`component-${component.index}`}
                  className="rounded-xl border border-slate-200 bg-white/90 p-2"
                >
                  <div className="flex justify-between text-[0.72rem] text-slate-600">
                    <span>#{component.index}</span>
                    <span>→ Object {component.targetId ?? "?"}</span>
                  </div>
                  <div className="mt-1 text-[0.7rem] text-slate-500">
                    Transform: {component.hasTransform ? "custom" : "identity"}
                  </div>
                  {component.uuid ? (
                    <div className="mt-1 font-mono text-[0.68rem] leading-snug text-slate-500 break-all">
                      UUID: {component.uuid}
                    </div>
                  ) : null}
                  {component.hasTransform && component.transform4x3 ? (
                    <pre className="mt-1 whitespace-pre-wrap rounded border border-slate-200 bg-slate-50/80 p-2 text-[0.68rem] text-slate-600">
                      {formatMatrix4x3(component.transform4x3)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {hasTransformsList ? (
          <section className="space-y-2">
            <header className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Transforms
            </header>
            <ul className="space-y-1">
              {selectedMeta.transforms.map((transform, transformIndex) => (
                <li
                  key={`transform-${transformIndex}-${transform.label || "matrix"}`}
                  className="rounded-xl border border-slate-200 bg-white/90 p-2"
                >
                  <div className="text-[0.72rem] font-semibold text-slate-600">
                    {transform.label || `Transform ${transformIndex + 1}`}
                  </div>
                  {transform.matrix4x3 ? (
                    <pre className="mt-1 whitespace-pre-wrap rounded border border-slate-200 bg-slate-50/80 p-2 text-[0.68rem] text-slate-600">
                      {formatMatrix4x3(transform.matrix4x3)}
                    </pre>
                  ) : (
                    <div className="mt-1 text-[0.7rem] text-slate-500">Identity</div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </Modal>
  ) : null;

  const detailRows = selectedInfo?.meta
    ? (() => {
        const rows = [];
        const meta = selectedInfo.meta;
        if (typeof meta.vertexCount === "number") {
          rows.push({
            label: "Vertices",
            value: meta.vertexCount.toLocaleString(),
            numeric: true,
            align: "right",
          });
        }
        if (typeof meta.triangleCount === "number") {
          rows.push({
            label: "Triangles",
            value: meta.triangleCount.toLocaleString(),
            numeric: true,
            align: "right",
          });
        }
        const trianglesWithColors = meta.materialColorStats?.trianglesWithColor ?? null;
        if (meta.color && (!Number.isFinite(trianglesWithColors) || trianglesWithColors === 0)) {
          rows.push({
            label: "Color",
            value: (
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: meta.color }} />
                {meta.color}
              </span>
            ),
            align: "left",
          });
        }
        if (meta.resourceId !== undefined) {
          rows.push({
            label: "Resource ID",
            value: Number.isFinite(meta.resourceId) ? meta.resourceId.toLocaleString() : String(meta.resourceId),
            numeric: true,
            align: "right",
          });
        }
        if (meta.uniqueResourceId !== undefined) {
          rows.push({
            label: "Unique resource ID",
            value: Number.isFinite(meta.uniqueResourceId)
              ? meta.uniqueResourceId.toLocaleString()
              : String(meta.uniqueResourceId),
            numeric: true,
            align: "right",
          });
        }
        if (meta.materialColorStats?.triangleCount !== undefined) {
          const total = meta.materialColorStats.triangleCount ?? 0;
          const colored = meta.materialColorStats.trianglesWithColor ?? 0;
          rows.push({
            label: "Triangles w/ colors",
            value: `${colored.toLocaleString()} / ${total.toLocaleString()}`,
            numeric: true,
            align: "right",
          });
        }
        const referencedGroups = Array.isArray(meta.materialColorStats?.referencedResourceIds)
          ? meta.materialColorStats.referencedResourceIds
          : Array.isArray(meta.materialResourceIds)
          ? meta.materialResourceIds
          : [];
        if (referencedGroups.length) {
          rows.push({
            label: "Material groups",
            value: `${referencedGroups.length} group${referencedGroups.length === 1 ? "" : "s"}`,
            align: "right",
          });
        }
        if (meta.objectLevelProperty?.ok) {
          rows.push({
            label: "Object-level property",
            value: (
              <div className="flex flex-wrap items-center gap-2 text-[0.68rem] text-slate-600">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold uppercase tracking-[0.18em] text-[0.58rem] text-slate-600">
                  Group {meta.objectLevelProperty.resourceId ?? "?"}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold uppercase tracking-[0.18em] text-[0.58rem] text-slate-600">
                  PID {meta.objectLevelProperty.propertyId ?? "?"}
                </span>
              </div>
            ),
            align: "left",
          });
        }
        if (meta.meshDiagnostics?.manifoldOriented !== undefined) {
          rows.push({
            label: "Manifold",
            value: meta.meshDiagnostics.manifoldOriented ? "Yes" : "No",
            align: "right",
          });
        }
        if (meta.meshDiagnostics?.hasSlices) {
          rows.push({ label: "Slices", value: "Yes", align: "right" });
        }
        if (meta.childCount !== undefined) {
          rows.push({
            label: "Children",
            value: Number.isFinite(meta.childCount) ? meta.childCount.toLocaleString() : String(meta.childCount),
            numeric: true,
            align: "right",
          });
        }
        return rows;
      })()
    : [];

  const infoSection = selectedInfo ? (
    <div className="border-t border-slate-200 px-5 py-3 text-xs text-slate-600">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-700" title={selectedInfo.name}>
            {selectedInfo.name}
          </div>
          <div className="mt-0.5 capitalize text-slate-500">{selectedInfo.type}</div>
        </div>
        <button
          type="button"
          className="rounded-full border border-slate-200 bg-white/90 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 shadow-sm transition hover:bg-white hover:text-slate-700"
          onClick={() => setInfoCollapsed((prev) => !prev)}
        >
          {infoCollapsed ? "Show" : "Hide"} details
        </button>
      </div>
      {selectedInfo.meta && !infoCollapsed ? (
        <>
          {detailRows.length ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm">
              <table className="min-w-full table-fixed border-collapse text-xs">
                <tbody>
                  {detailRows.map((row, index) => (
                    <tr key={`${row.label}-${index}`} className={index % 2 === 1 ? "bg-slate-50/70" : "bg-white"}>
                      <th
                        scope="row"
                        className="w-[45%] align-top border border-slate-200 px-3 py-2 text-left font-semibold uppercase tracking-wide text-slate-500"
                      >
                        {row.label}
                      </th>
                      {(() => {
                        const textAlign = row.align === "right" || (row.align !== "left" && (row.numeric || row.align === "end")) ? "text-right" : "text-left";
                        const extra = row.numeric || row.align === "right" ? "tabular-nums" : "";
                        return (
                          <td
                            className={`w-[55%] align-top border border-slate-200 px-3 py-2 text-slate-700 ${textAlign} ${extra}`.trim()}
                          >
                            <span className="block break-words leading-snug">{row.value}</span>
                          </td>
                        );
                      })()}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {modalHasContent ? (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-600 shadow-sm transition hover:bg-white hover:text-slate-800"
                onClick={() => setMaterialModalOpen(true)}
              >
                View more details
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  ) : null;

  if (variant === "drawer") {
    const drawerShellClasses = `fixed inset-0 z-50 transition duration-200 ${
      open ? "pointer-events-auto" : "pointer-events-none"
    } ${className}`.trim();

    const overlayClasses = `absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-200 ${
      open ? "opacity-100" : "opacity-0"
    }`;

    const panelClasses = `absolute left-0 top-0 h-full w-[min(85vw,22rem)] -translate-x-full transform transition-transform duration-200 ease-out ${
      open ? "translate-x-0" : ""
    }`;

    return (
      <>
        <div className={drawerShellClasses} aria-label="Scene Tree Drawer">
          <div className={overlayClasses} onClick={onClose} />
          <div className={panelClasses}>
            <div className="flex h-full flex-col overflow-hidden bg-white shadow-xl ring-1 ring-slate-200">
              {sharedHeader}
              {listSection}
              {infoSection}
            </div>
          </div>
        </div>
        {modelInfoModal}
        {specModal}
        {moreDetailsModal}
      </>
    );
  }

  const panelWrapper = `pointer-events-auto fixed inset-x-4 top-[5rem] z-40 mx-auto w-[min(90vw,20rem)] lg:inset-auto lg:left-4 lg:top-[5rem] lg:mx-0 lg:w-[min(22vw,20rem)] ${className}`.trim();

  return (
    <>
      <aside className={panelWrapper} aria-label="Scene Tree">
        <div className="flex max-h-[calc(100vh-10rem)] flex-col overflow-hidden rounded-2xl bg-white/95 backdrop-blur-sm ring-1 ring-slate-200 shadow-lg sm:max-h-[calc(100vh-5rem)]">
          {sharedHeader}
          {listSection}
          {infoSection}
        </div>
      </aside>
      {modelInfoModal}
      {specModal}
      {moreDetailsModal}
    </>
  );
}
