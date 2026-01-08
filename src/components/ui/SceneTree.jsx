import React, { useEffect, useMemo, useRef, useState } from "react";

import { useViewerStore } from "../../stores/viewerStore.js";
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
  IconMore,
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

const areSpecResultsEqual = (left, right) => {
  if (left === right) return true;
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  return left.every((item, index) => {
    const other = right[index];
    if (!item || !other) return item === other;
    return (
      item.url === other.url &&
      item.supported === other.supported &&
      item.major === other.major &&
      item.minor === other.minor &&
      item.micro === other.micro
    );
  });
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
  const visibilityKey = node.visibilityId ?? node.id;
  const hidden = isMesh ? hiddenMeshIds.includes(visibilityKey) : false;
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
        } ${isSelected ? "bg-surface ring-1 ring-border" : "hover:bg-surface/70"}`}
        title={tooltip}
      >
        <span className="w-5 text-center text-text-muted">
          {hasChildren ? <IconCaret open={isOpen} /> : null}
        </span>
        <span className="w-5 text-center text-text-muted">{ICONS[node.type] || "•"}</span>
        <span className="text-sm truncate" title={tooltip}>
          {node.name}
        </span>
        {isMesh && (
          <button
            type="button"
            aria-label={hidden ? "Show mesh" : "Hide mesh"}
            className={`ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-elevated/80 text-text-secondary transition hover:bg-surface-elevated ${
              hidden ? "opacity-70" : ""
            }`}
            onClick={(event) => {
              event.stopPropagation();
              onToggleVisibility?.(visibilityKey);
            }}
          >
            {hidden ? <IconHidden /> : <IconVisible />}
          </button>
        )}
      </div>
      {hasChildren && isOpen && (
        <ul className="pl-6 border-l border-border ml-4">
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
}) {
  const inputRef = useRef(null);
  const specificationResults = useViewerStore((state) => state.specs.specResults);
  const sceneTreeState = useViewerStore((state) =>
    variant === "drawer" ? state.sceneTree.drawer : state.sceneTree.panel
  );
  const setSceneTreeState = useViewerStore((state) =>
    variant === "drawer" ? state.setSceneTreeDrawer : state.setSceneTreePanel
  );
  const modelInfoOpen = sceneTreeState.modelInfoOpen;
  const modelInfoTab = sceneTreeState.modelInfoTab;
  const infoCollapsed = sceneTreeState.infoCollapsed;
  const specModalOpen = sceneTreeState.specModalOpen;
  const specInputValue = sceneTreeState.specInputValue;
  const materialModalOpen = sceneTreeState.materialModalOpen;
  const localSpecResults = sceneTreeState.localSpecResults;
  const setModelInfoOpen = (open) => setSceneTreeState({ modelInfoOpen: open });
  const setModelInfoTab = (tab) => setSceneTreeState({ modelInfoTab: tab });
  const setInfoCollapsed = (collapsed) => setSceneTreeState({ infoCollapsed: collapsed });
  const setSpecModalOpen = (open) => setSceneTreeState({ specModalOpen: open });
  const setSpecInputValue = (value) => setSceneTreeState({ specInputValue: value });
  const setMaterialModalOpen = (open) => setSceneTreeState({ materialModalOpen: open });
  const setLocalSpecResults = (value) => setSceneTreeState({ localSpecResults: value });

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
        <span className="text-xs text-text-muted truncate" title={fileName}>
          Loaded: {fileName}
        </span>
      );
    }
    return (
      <span className="text-xs text-text-muted">
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
  const baseMaterialGroups = useMemo(() => {
    if (!Array.isArray(metadata?.baseMaterialGroups)) return [];
    return metadata.baseMaterialGroups;
  }, [metadata?.baseMaterialGroups]);

  const colorGroups = useMemo(() => {
    if (!Array.isArray(metadata?.colorGroups)) return [];
    return metadata.colorGroups;
  }, [metadata?.colorGroups]);

  const sliceStacks = useMemo(() => {
    if (!Array.isArray(metadata?.sliceStacks)) return [];
    return metadata.sliceStacks;
  }, [metadata?.sliceStacks]);

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
        if (typeof metadata.counts?.sliceStacks === "number") {
          rows.push({ label: "Slice stacks", value: metadata.counts.sliceStacks.toLocaleString(), numeric: true });
        }
        return rows;
      })()
    : [];

  const summaryContent = isReady ? (
    <div className="space-y-6 text-xs text-text-secondary">
      <section className="space-y-3">
        <div className="text-sm font-semibold text-text-primary">Model snapshot</div>
        <div className="overflow-hidden rounded-2xl border border-border shadow-sm">
          <table className="min-w-full divide-y divide-border text-sm">
            <tbody className="bg-surface-elevated">
              {summaryRows.map((row) => (
                <tr key={row.label} className="even:bg-surface/70">
                  <th className="w-1/3 px-4 py-3 text-left font-semibold text-text-secondary">
                    {row.label}
                  </th>
                  <td className="px-4 py-3 text-right text-text-primary">
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
          <div className="text-sm font-semibold text-text-primary">Base material groups</div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {baseMaterialGroups.map((group) => (
              <li
                key={`bmat-${group.groupId ?? group.index}`}
                className="rounded-2xl border border-border bg-surface-elevated/80 p-3 shadow-sm"
              >
                <div className="flex justify-between text-[0.72rem] text-text-muted">
                  <span>Group {group.groupId ?? "?"}</span>
                  <span>
                    {group.materials?.length ?? 0} material
                    {(group.materials?.length ?? 0) === 1 ? "" : "s"}
                  </span>
                </div>
                {group.uuid ? (
                  <div className="mt-2 font-mono text-[0.68rem] leading-snug text-text-muted break-all">
                    UUID: {group.uuid}
                  </div>
                ) : null}
                {Array.isArray(group.materials) && group.materials.length ? (
                  <ul className="mt-2 space-y-1">
                    {group.materials.map((mat) => (
                      <li
                        key={`bmat-${group.groupId}-${mat.propertyId}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border-subtle bg-surface/80 px-2 py-1"
                      >
                        <div className="flex flex-col">
                          <span className="truncate text-[0.72rem] text-text-secondary">
                            {mat.name || `Material ${mat.propertyIndex ?? mat.propertyId}`}
                          </span>
                          <span className="text-[0.62rem] uppercase tracking-[0.18em] text-text-muted">
                            ID {mat.propertyId ?? '—'} · index {mat.propertyIndex ?? '—'}
                          </span>
                        </div>
                        <span className="inline-flex items-center gap-1 text-[0.7rem] text-text-muted">
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
          <div className="text-sm font-semibold text-text-primary">Color groups</div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {colorGroups.map((group) => (
              <li
                key={`cgroup-${group.groupId ?? group.index}`}
                className="rounded-2xl border border-border bg-surface-elevated/80 p-3 shadow-sm"
              >
                <div className="flex justify-between text-[0.72rem] text-text-muted">
                  <span>Group {group.groupId ?? "?"}</span>
                  <span>
                    {group.colors?.length ?? 0} color
                    {(group.colors?.length ?? 0) === 1 ? "" : "s"}
                  </span>
                </div>
                {group.uuid ? (
                  <div className="mt-2 font-mono text-[0.68rem] leading-snug text-text-muted break-all">
                    UUID: {group.uuid}
                  </div>
                ) : null}
                {Array.isArray(group.colors) && group.colors.length ? (
                  <ul className="mt-2 space-y-1">
                    {group.colors.map((entry, idx) => (
                      <li
                        key={`cgroup-${group.groupId}-${entry.propertyId ?? idx}-${entry.propertyIndex ?? idx}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border-subtle bg-surface/80 px-2 py-1"
                      >
                        <div className="flex flex-col">
                          <span className="text-[0.72rem] text-text-secondary">
                            {colorToLabel(entry.color)}
                          </span>
                          <span className="text-[0.62rem] uppercase tracking-[0.18em] text-text-muted">
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

      {sliceStacks.length ? (
        <section className="space-y-2">
          <div className="text-sm font-semibold text-text-primary">Slice stacks</div>
          <ul className="space-y-2">
            {sliceStacks.map((stack, stackIdx) => {
              const zRange = (() => {
                if (!Array.isArray(stack.slices) || !stack.slices.length) return null;
                const zValues = stack.slices
                  .map((s) => s.zTop)
                  .filter((z) => Number.isFinite(z));
                if (!zValues.length) return null;
                const minZ = Math.min(...zValues);
                const maxZ = Math.max(...zValues);
                return { min: minZ, max: maxZ };
              })();
              const totalVertices = Array.isArray(stack.slices)
                ? stack.slices.reduce((sum, s) => sum + (s.vertexCount ?? 0), 0)
                : 0;
              const totalPolygons = Array.isArray(stack.slices)
                ? stack.slices.reduce((sum, s) => sum + (s.polygonCount ?? 0), 0)
                : 0;

              return (
                <li
                  key={`slice-stack-${stack.resourceId ?? stackIdx}`}
                  className="rounded-2xl border border-border bg-surface-elevated/80 p-3 shadow-sm"
                >
                  <div className="flex justify-between text-[0.72rem] text-text-muted">
                    <span>Stack {stack.resourceId ?? stackIdx + 1}</span>
                    <span>
                      {stack.sliceCount ?? stack.slices?.length ?? 0} slice
                      {(stack.sliceCount ?? stack.slices?.length ?? 0) === 1 ? "" : "s"}
                    </span>
                  </div>
                  {stack.uuid ? (
                    <div className="mt-2 font-mono text-[0.68rem] leading-snug text-text-muted break-all">
                      UUID: {stack.uuid}
                    </div>
                  ) : null}
                  <div className="mt-2 space-y-1">
                    {stack.bottomZ !== null && stack.bottomZ !== undefined && (
                      <div className="flex justify-between text-[0.72rem]">
                        <span className="text-text-muted">Bottom Z</span>
                        <span className="tabular-nums text-text-primary">{stack.bottomZ}</span>
                      </div>
                    )}
                    {zRange && (
                      <div className="flex justify-between text-[0.72rem]">
                        <span className="text-text-muted">Z range</span>
                        <span className="tabular-nums text-text-primary">
                          {zRange.min.toFixed(3)} — {zRange.max.toFixed(3)}
                        </span>
                      </div>
                    )}
                    {totalVertices > 0 && (
                      <div className="flex justify-between text-[0.72rem]">
                        <span className="text-text-muted">Total vertices</span>
                        <span className="tabular-nums text-text-primary">{totalVertices.toLocaleString()}</span>
                      </div>
                    )}
                    {totalPolygons > 0 && (
                      <div className="flex justify-between text-[0.72rem]">
                        <span className="text-text-muted">Total polygons</span>
                        <span className="tabular-nums text-text-primary">{totalPolygons.toLocaleString()}</span>
                      </div>
                    )}
                    {stack.ownPath && (
                      <div className="flex justify-between text-[0.72rem]">
                        <span className="text-text-muted">Path</span>
                        <span className="font-mono text-[0.68rem] text-text-primary truncate max-w-[60%]" title={stack.ownPath}>
                          {stack.ownPath}
                        </span>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  ) : null;

  let diagnosticsContent = null;
  if (isReady && diagnosticsSummary) {
    diagnosticsContent = (
      <div className="space-y-4 text-xs text-text-secondary">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface-elevated/80 p-4 shadow-sm">
            <div className="text-sm font-semibold text-text-primary">Warnings</div>
            <div className="mt-1 text-2xl font-semibold text-amber-600">{totalWarnings.toLocaleString()}</div>
            <p className="mt-2 text-[0.75rem] text-text-muted">
              Combined warnings from strict and non-strict parsing passes.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-elevated/80 p-4 shadow-sm">
            <div className="text-sm font-semibold text-text-primary">Errors</div>
            <div className="mt-1 text-2xl font-semibold text-rose-600">{totalErrors.toLocaleString()}</div>
            <p className="mt-2 text-[0.75rem] text-text-muted">
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
              <section key={mode} className="rounded-2xl border border-border bg-surface-elevated/90 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-text-primary">{label}</div>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[0.7rem] font-medium text-emerald-600">
                    Clean
                  </span>
                </div>
                <p className="mt-2 text-[0.75rem] text-text-muted">No warnings or errors reported.</p>
              </section>
            );
          }

          return (
            <section key={mode} className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-text-primary">{label}</div>
                <div className="flex items-center gap-2 text-[0.7rem] text-text-muted">
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
        <div className="space-y-6 text-xs text-text-secondary">
          <div className="flex items-center gap-2 rounded-full bg-surface p-1 text-[0.72rem] font-medium">
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
                      ? "bg-surface-elevated text-text-primary shadow"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  {tab.label}
                  {tab.badge ? (
                    <span
                      className={`inline-flex min-w-[1.5rem] justify-center rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${
                        tab.badge > 0 ? "bg-rose-100 text-rose-600" : "bg-surface text-text-secondary"
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
      setSceneTreeState({
        modelInfoOpen: false,
        modelInfoTab: "summary",
        specModalOpen: false,
        materialModalOpen: false,
      });
    }
  }, [loadStatus, setSceneTreeState]);

  useEffect(() => {
    if (specificationResults?.length) {
      const text = specificationResults.map((s) => s.url).filter(Boolean).join("\n");
      if (text.length) {
        setSceneTreeState({ specInputValue: text });
        return;
      }
    }
  }, [
    specificationResults,
    metadata?.specifications,
    metadata?.primarySpecification?.url,
    metadata?.specification?.url,
    setSceneTreeState,
  ]);

  useEffect(() => {
    setSceneTreeState({ infoCollapsed: false, materialModalOpen: false });
  }, [selectedInfo?.id, setSceneTreeState]);

  const sharedHeader = (
    <div
      className={`flex flex-col gap-3 px-5 pt-4 pb-3 shrink-0 border-b border-border ${
        variant === "drawer" ? "bg-surface-elevated" : "bg-surface-elevated/95"
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
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:h-9 sm:w-9"
              onClick={handleFileClick}
              title="Load new data"
              aria-label="Load new data"
            >
              <IconUpload />
            </button>
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-elevated text-text-muted shadow-sm transition hover:bg-surface hover:text-text-secondary disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 sm:w-9"
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
                  ? "cursor-not-allowed bg-surface text-text-muted"
                  : hasDiagnosticsAttention
                  ? "bg-rose-600 text-white hover:bg-rose-700"
                  : "bg-accent text-accent-foreground hover:bg-accent-hover"
              }`}
              type="button"
              disabled={!isReady}
              title={isReady ? "Open validator" : "Validator available after loading"}
              aria-label="Open validator"
              onClick={() => handleOpenModelInfo("diagnostics")}
            >
              <IconValidate />
              {hasDiagnosticsAttention ? (
                <span className="absolute -top-1 -right-1 inline-flex min-w-[1.25rem] justify-center rounded-full bg-surface-elevated/90 px-1 py-0.5 text-[0.65rem] font-semibold text-rose-600 shadow">
                  {Math.min(totalWarnings + totalErrors, 99)}
                </span>
              ) : null}
            </button>
            <button
              className={`inline-flex h-10 w-10 items-center justify-center rounded-full shadow-sm transition sm:h-9 sm:w-9 ${
                !isReady
                  ? "cursor-not-allowed bg-surface text-text-muted"
                  : "bg-accent text-accent-foreground hover:bg-accent-hover"
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
                  ? "cursor-not-allowed bg-surface text-text-muted"
                  : "bg-accent text-accent-foreground hover:bg-accent-hover"
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
                className="rounded-full border border-transparent bg-surface/80 p-2 text-text-muted transition hover:bg-surface hover:text-text-primary"
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
    <div className="flex-[3] min-h-0 overflow-y-auto px-3 py-3">
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
        <div className="text-xs text-text-muted px-2 py-3">
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
    if (areSpecResultsEqual(specifications, localSpecResults)) return;
    setSceneTreeState({ localSpecResults: specifications });
  }, [specifications, localSpecResults, setSceneTreeState]);

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
      const rawPropertyIds = Array.isArray(groupInfo.propertyIds)
        ? Array.from(
            new Set(
              groupInfo.propertyIds.map((pid) =>
                Number.isFinite(Number(pid)) ? Number(pid) : String(pid)
              )
            )
          )
        : [];
      const propertyIdTotal = rawPropertyIds.length;
      const isMaterialGroup = groupType === "BaseMaterialGroup" || groupType === "ColorGroup";
      const maxPropertyPreview = 200;
      const propertyIds = isMaterialGroup ? rawPropertyIds.slice(0, maxPropertyPreview) : [];
      const propertyLimitReached = isMaterialGroup && propertyIdTotal > maxPropertyPreview;
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
        propertyIdTotal,
        propertyLimitReached,
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

  const sliceStackDetails = useMemo(() => {
    const diag = selectedInfo?.meta?.meshDiagnostics;
    if (!diag?.hasSlices) return null;
    const stackId = diag.sliceStackId ?? null;
    let matchedStack = null;
    if (Array.isArray(sliceStacks) && sliceStacks.length) {
      if (stackId !== null && stackId !== undefined) {
        const stackIdKey = String(stackId);
        matchedStack =
          sliceStacks.find((stack) => {
            if (!stack) return false;
            const keys = [stack.resourceId, stack.uniqueResourceId].filter(
              (value) => value !== undefined && value !== null
            );
            return keys.some((value) => String(value) === stackIdKey);
          }) ?? null;
      } else if (sliceStacks.length === 1) {
        matchedStack = sliceStacks[0];
      }
    }
    const slices = Array.isArray(matchedStack?.slices) ? matchedStack.slices : [];
    const zValues = slices
      .map((slice) => slice?.zTop)
      .filter((value) => Number.isFinite(value));
    const zRange = zValues.length
      ? { min: Math.min(...zValues), max: Math.max(...zValues) }
      : null;
    const totalVertices = slices.reduce((sum, slice) => sum + (slice?.vertexCount ?? 0), 0);
    const totalPolygons = slices.reduce((sum, slice) => sum + (slice?.polygonCount ?? 0), 0);
    const references = Array.isArray(matchedStack?.references) ? matchedStack.references : [];
    return {
      diag,
      stack: matchedStack,
      zRange,
      totalVertices,
      totalPolygons,
      references,
    };
  }, [selectedInfo?.meta?.meshDiagnostics, sliceStacks]);

  const selectedMeta = selectedInfo?.meta || null;
  const hasMetadataEntries = Array.isArray(selectedMeta?.metadataEntries) && selectedMeta.metadataEntries.length > 0;
  const hasComponentsList = Array.isArray(selectedMeta?.components) && selectedMeta.components.length > 0;
  const hasTransformsList = Array.isArray(selectedMeta?.transforms) && selectedMeta.transforms.length > 0;
  const hasUuidInfo = Boolean(selectedMeta?.uuid || selectedMeta?.buildItemUuid || selectedMeta?.hasUUID !== undefined);
  const hasMaterialUsage = materialUsageDetails.length > 0;
  const hasSliceStackDetails = Boolean(sliceStackDetails);
  const modalHasContent =
    hasMaterialUsage || hasMetadataEntries || hasComponentsList || hasTransformsList || hasUuidInfo || hasSliceStackDetails;

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
          className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow transition hover:bg-accent-hover"
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
        className="w-full rounded-2xl border border-border bg-surface-elevated px-4 py-3 text-sm text-text-primary shadow-inner focus:outline-none focus:ring-2 focus:ring-accent"
        rows={6}
      />
      {(localSpecResults?.length ?? 0) ? (
        <div className="mt-4 space-y-2 text-xs text-text-secondary">
          <div className="font-semibold text-text-primary">Current results</div>
          <ul className="space-y-1">
            {localSpecResults.map((spec, index) => (
              <li
                key={`${spec.url || "spec"}-${index}`}
                className="rounded-xl border border-border bg-surface-elevated/95 px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[0.72rem] font-semibold text-text-primary break-all">
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
                  <div className="mt-1 text-[0.68rem] text-text-muted">
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
      <div className="space-y-4 text-xs text-text-secondary">
        {hasUuidInfo ? (
          <section className="space-y-2">
            <header className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
              Identifiers
            </header>
            <ul className="space-y-1">
              {selectedMeta?.uuid ? (
                <li className="rounded-xl border border-border bg-surface-elevated/90 px-3 py-2">
                  <div className="text-[0.7rem] font-semibold text-text-secondary">Resource UUID</div>
                  <div className="mt-1 break-all font-mono text-[0.66rem] leading-snug text-text-muted">
                    {selectedMeta.uuid}
                  </div>
                </li>
              ) : null}
              {selectedMeta?.buildItemUuid ? (
                <li className="rounded-xl border border-border bg-surface-elevated/90 px-3 py-2">
                  <div className="text-[0.7rem] font-semibold text-text-secondary">Build item UUID</div>
                  <div className="mt-1 break-all font-mono text-[0.66rem] leading-snug text-text-muted">
                    {selectedMeta.buildItemUuid}
                  </div>
                </li>
              ) : null}
              {selectedMeta?.hasUUID !== undefined ? (
                <li className="rounded-xl border border-border bg-surface-elevated/90 px-3 py-2">
                  <div className="text-[0.7rem] font-semibold text-text-secondary">UUID present</div>
                  <div className="mt-1 text-[0.7rem] text-text-primary">
                    {selectedMeta.hasUUID ? "Yes" : "No"}
                  </div>
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}

        {hasMaterialUsage ? (
          <section className="space-y-2">
            <header className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
              Material usage
            </header>
            <div className="space-y-2">
              {materialUsageDetails.map((entry) => (
                <article
                  key={`material-modal-${entry.resourceKey}`}
                  className="rounded-2xl border border-border bg-surface-elevated/95 p-3 shadow-sm"
                >
                  <header className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[0.78rem] font-semibold text-text-primary">
                      {entry.label}
                    </div>
                    <div className="inline-flex items-center gap-2 text-[0.7rem] text-text-muted">
                      <span className="rounded-full bg-surface px-2 py-0.5 uppercase tracking-[0.22em] text-[0.62rem] text-text-secondary">
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
                    <div className="mt-1 font-mono text-[0.66rem] leading-snug text-text-muted break-all">
                      UUID: {entry.uuid}
                    </div>
                  ) : null}
                  {entry.properties.length ? (
                    <ul className="mt-3 space-y-1">
                      {entry.properties.map((prop) => (
                        <li
                          key={`material-modal-${entry.resourceKey}-prop-${prop.propertyId}`}
                          className="flex items-center justify-between gap-2 rounded-xl border border-border-subtle bg-surface/80 px-3 py-2"
                        >
                          <div className="truncate text-[0.72rem] text-text-secondary" title={prop.label}>
                            {prop.label}
                          </div>
                          <div className="inline-flex items-center gap-2 text-[0.65rem] text-text-muted">
                            {prop.color ? (
                              <>
                                <span
                                  className="h-3 w-3 rounded"
                                  style={{ backgroundColor: colorToCss(prop.color) || "transparent" }}
                                />
                                <span>{colorToLabel(prop.color)}</span>
                              </>
                            ) : (
                              <span className={prop.hasColor ? "text-emerald-600" : "text-text-muted"}>
                                {prop.hasColor ? "Colored" : "No per-face color"}
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : entry.propertyIdTotal ? (
                    <div className="mt-3 text-[0.66rem] text-text-muted">
                      {entry.propertyLimitReached
                        ? `Showing first ${entry.properties.length} of ${entry.propertyIdTotal} property IDs.`
                        : `${entry.propertyIdTotal} property ID${entry.propertyIdTotal === 1 ? "" : "s"} reported.`}
                    </div>
                  ) : (
                    <div className="mt-3 text-[0.66rem] text-text-muted">No property IDs reported.</div>
                  )}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {hasSliceStackDetails ? (
          <section className="space-y-2">
            <header className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
              Slice stack
            </header>
            <ul className="space-y-1">
              {(sliceStackDetails.stack?.resourceId ?? sliceStackDetails.diag?.sliceStackId) !== null &&
              (sliceStackDetails.stack?.resourceId ?? sliceStackDetails.diag?.sliceStackId) !== undefined ? (
                <li className="rounded-xl border border-border bg-surface-elevated/90 px-3 py-2">
                  <div className="text-[0.7rem] font-semibold text-text-secondary">Resource ID</div>
                  <div className="mt-1 text-[0.7rem] text-text-primary tabular-nums">
                    {sliceStackDetails.stack?.resourceId ?? sliceStackDetails.diag?.sliceStackId}
                  </div>
                </li>
              ) : null}
              {sliceStackDetails.stack?.uniqueResourceId !== null &&
              sliceStackDetails.stack?.uniqueResourceId !== undefined ? (
                <li className="rounded-xl border border-border bg-surface-elevated/90 px-3 py-2">
                  <div className="text-[0.7rem] font-semibold text-text-secondary">Unique resource ID</div>
                  <div className="mt-1 text-[0.7rem] text-text-primary tabular-nums">
                    {sliceStackDetails.stack.uniqueResourceId}
                  </div>
                </li>
              ) : null}
              {(sliceStackDetails.stack?.uuid || sliceStackDetails.diag?.sliceStackUuid) ? (
                <li className="rounded-xl border border-border bg-surface-elevated/90 px-3 py-2">
                  <div className="text-[0.7rem] font-semibold text-text-secondary">Slice stack UUID</div>
                  <div className="mt-1 break-all font-mono text-[0.66rem] leading-snug text-text-muted">
                    {sliceStackDetails.stack?.uuid ?? sliceStackDetails.diag?.sliceStackUuid}
                  </div>
                </li>
              ) : null}
              {(sliceStackDetails.stack?.hasUUID ?? sliceStackDetails.diag?.sliceStackHasUUID) !== undefined ? (
                <li className="rounded-xl border border-border bg-surface-elevated/90 px-3 py-2">
                  <div className="text-[0.7rem] font-semibold text-text-secondary">UUID present</div>
                  <div className="mt-1 text-[0.7rem] text-text-primary">
                    {(sliceStackDetails.stack?.hasUUID ?? sliceStackDetails.diag?.sliceStackHasUUID) ? "Yes" : "No"}
                  </div>
                </li>
              ) : null}
              {(sliceStackDetails.stack?.sliceCount ?? sliceStackDetails.diag?.sliceCount) ? (
                <li className="rounded-xl border border-border bg-surface-elevated/90 px-3 py-2">
                  <div className="text-[0.7rem] font-semibold text-text-secondary">Slice count</div>
                  <div className="mt-1 text-[0.7rem] text-text-primary tabular-nums">
                    {(sliceStackDetails.stack?.sliceCount ?? sliceStackDetails.diag?.sliceCount).toLocaleString()}
                  </div>
                </li>
              ) : null}
              {(sliceStackDetails.stack?.bottomZ ?? sliceStackDetails.diag?.sliceBottomZ) !== null &&
              (sliceStackDetails.stack?.bottomZ ?? sliceStackDetails.diag?.sliceBottomZ) !== undefined ? (
                <li className="rounded-xl border border-border bg-surface-elevated/90 px-3 py-2">
                  <div className="text-[0.7rem] font-semibold text-text-secondary">Bottom Z</div>
                  <div className="mt-1 text-[0.7rem] text-text-primary tabular-nums">
                    {sliceStackDetails.stack?.bottomZ ?? sliceStackDetails.diag?.sliceBottomZ}
                  </div>
                </li>
              ) : null}
              {sliceStackDetails.zRange ? (
                <li className="rounded-xl border border-border bg-surface-elevated/90 px-3 py-2">
                  <div className="text-[0.7rem] font-semibold text-text-secondary">Z range</div>
                  <div className="mt-1 text-[0.7rem] text-text-primary tabular-nums">
                    {sliceStackDetails.zRange.min.toFixed(3)} — {sliceStackDetails.zRange.max.toFixed(3)}
                  </div>
                </li>
              ) : null}
              {sliceStackDetails.diag?.slicesMeshResolution?.name ? (
                <li className="rounded-xl border border-border bg-surface-elevated/90 px-3 py-2">
                  <div className="text-[0.7rem] font-semibold text-text-secondary">Slice resolution</div>
                  <div className="mt-1 text-[0.7rem] text-text-primary">
                    {sliceStackDetails.diag.slicesMeshResolution.name}
                  </div>
                </li>
              ) : null}
              {sliceStackDetails.totalVertices > 0 ? (
                <li className="rounded-xl border border-border bg-surface-elevated/90 px-3 py-2">
                  <div className="text-[0.7rem] font-semibold text-text-secondary">Total vertices</div>
                  <div className="mt-1 text-[0.7rem] text-text-primary tabular-nums">
                    {sliceStackDetails.totalVertices.toLocaleString()}
                  </div>
                </li>
              ) : null}
              {sliceStackDetails.totalPolygons > 0 ? (
                <li className="rounded-xl border border-border bg-surface-elevated/90 px-3 py-2">
                  <div className="text-[0.7rem] font-semibold text-text-secondary">Total polygons</div>
                  <div className="mt-1 text-[0.7rem] text-text-primary tabular-nums">
                    {sliceStackDetails.totalPolygons.toLocaleString()}
                  </div>
                </li>
              ) : null}
              {sliceStackDetails.stack?.ownPath ? (
                <li className="rounded-xl border border-border bg-surface-elevated/90 px-3 py-2">
                  <div className="text-[0.7rem] font-semibold text-text-secondary">Path</div>
                  <div className="mt-1 truncate font-mono text-[0.66rem] leading-snug text-text-muted">
                    {sliceStackDetails.stack.ownPath}
                  </div>
                </li>
              ) : null}
            </ul>
            {sliceStackDetails.references.length ? (
              <div className="space-y-1">
                <div className="text-[0.7rem] font-semibold text-text-secondary">References</div>
                <ul className="space-y-1">
                  {sliceStackDetails.references.map((ref, index) => (
                    <li
                      key={`slice-ref-${ref.resourceId ?? "none"}-${index}`}
                      className="rounded-xl border border-border bg-surface-elevated/90 px-3 py-2"
                    >
                      <div className="flex justify-between text-[0.7rem] text-text-secondary">
                        <span>Resource {ref.resourceId ?? "?"}</span>
                        {ref.uniqueResourceId !== null && ref.uniqueResourceId !== undefined ? (
                          <span>Unique {ref.uniqueResourceId}</span>
                        ) : null}
                      </div>
                      {ref.uuid ? (
                        <div className="mt-1 break-all font-mono text-[0.66rem] leading-snug text-text-muted">
                          UUID: {ref.uuid}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        ) : null}

        {hasMetadataEntries ? (
          <section className="space-y-2">
            <header className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
              Metadata entries
            </header>
            <ul className="space-y-1">
              {selectedMeta.metadataEntries.map((entry, index) => (
                <li
                  key={`${entry.key || entry.name || "meta"}-${index}`}
                  className="rounded-xl border border-border bg-surface-elevated/90 p-2"
                >
                  <div className="text-[0.72rem] font-semibold text-text-secondary">
                    {entry.key || entry.name || `Entry ${index + 1}`}
                  </div>
                  <div className="mt-0.5 break-words text-[0.8rem] text-text-primary">
                    {entry.value || "(empty)"}
                  </div>
                  {(entry.namespace || entry.type || entry.mustPreserve) && (
                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[0.68rem] text-text-muted">
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
            <header className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
              Components
            </header>
            <ul className="space-y-1">
              {selectedMeta.components.map((component) => (
                <li
                  key={`component-${component.index}`}
                  className="rounded-xl border border-border bg-surface-elevated/90 p-2"
                >
                  <div className="flex justify-between text-[0.72rem] text-text-secondary">
                    <span>#{component.index}</span>
                    <span>→ Object {component.targetId ?? "?"}</span>
                  </div>
                  <div className="mt-1 text-[0.7rem] text-text-muted">
                    Transform: {component.hasTransform ? "custom" : "identity"}
                  </div>
                  {component.uuid ? (
                    <div className="mt-1 font-mono text-[0.68rem] leading-snug text-text-muted break-all">
                      UUID: {component.uuid}
                    </div>
                  ) : null}
                  {component.hasTransform && component.transform4x3 ? (
                    <pre className="mt-1 whitespace-pre-wrap rounded border border-border bg-surface/80 p-2 text-[0.68rem] text-text-secondary">
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
            <header className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-text-muted">
              Transforms
            </header>
            <ul className="space-y-1">
              {selectedMeta.transforms.map((transform, transformIndex) => (
                <li
                  key={`transform-${transformIndex}-${transform.label || "matrix"}`}
                  className="rounded-xl border border-border bg-surface-elevated/90 p-2"
                >
                  <div className="text-[0.72rem] font-semibold text-text-secondary">
                    {transform.label || `Transform ${transformIndex + 1}`}
                  </div>
                  {transform.matrix4x3 ? (
                    <pre className="mt-1 whitespace-pre-wrap rounded border border-border bg-surface/80 p-2 text-[0.68rem] text-text-secondary">
                      {formatMatrix4x3(transform.matrix4x3)}
                    </pre>
                  ) : (
                    <div className="mt-1 text-[0.7rem] text-text-muted">Identity</div>
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
              <div className="flex flex-wrap items-center gap-2 text-[0.68rem] text-text-secondary">
                <span className="rounded-full bg-surface px-2 py-0.5 font-semibold uppercase tracking-[0.18em] text-[0.58rem] text-text-secondary">
                  Group {meta.objectLevelProperty.resourceId ?? "?"}
                </span>
                <span className="rounded-full bg-surface px-2 py-0.5 font-semibold uppercase tracking-[0.18em] text-[0.58rem] text-text-secondary">
                  PID {meta.objectLevelProperty.propertyId ?? "?"}
                </span>
              </div>
            ),
            align: "left",
          });
        }
        if (meta.meshDiagnostics?.hasSlices) {
          rows.push({ label: "Slices", value: "Yes", align: "right" });
          if (typeof meta.meshDiagnostics.sliceCount === "number") {
            rows.push({
              label: "Slice count",
              value: meta.meshDiagnostics.sliceCount.toLocaleString(),
              numeric: true,
              align: "right",
            });
          }
          if (meta.meshDiagnostics.sliceStackId !== null && meta.meshDiagnostics.sliceStackId !== undefined) {
            rows.push({
              label: "Slice stack ID",
              value: Number.isFinite(meta.meshDiagnostics.sliceStackId)
                ? meta.meshDiagnostics.sliceStackId.toLocaleString()
                : String(meta.meshDiagnostics.sliceStackId),
              numeric: Number.isFinite(meta.meshDiagnostics.sliceStackId),
              align: "right",
            });
          }
          if (meta.meshDiagnostics.slicesMeshResolution?.name) {
            rows.push({
              label: "Slice resolution",
              value: meta.meshDiagnostics.slicesMeshResolution.name,
              align: "right",
            });
          }
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
    <div className={`${infoCollapsed ? "shrink-0" : "flex-[2] min-h-0"} overflow-y-auto border-t border-border px-5 pt-3 pb-4 text-xs text-text-secondary`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-text-primary truncate" title={selectedInfo.name}>
            {selectedInfo.name}
          </div>
          <div className="mt-0.5 capitalize text-text-muted">{selectedInfo.type}</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            aria-label={infoCollapsed ? "Show details" : "Hide details"}
            title={infoCollapsed ? "Show details" : "Hide details"}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-border shadow-sm transition hover:bg-surface-elevated ${
              infoCollapsed ? "bg-surface text-text-muted" : "bg-surface-elevated text-text-primary"
            }`}
            onClick={() => setInfoCollapsed((prev) => !prev)}
          >
            {infoCollapsed ? <IconHidden /> : <IconVisible />}
          </button>
          {modalHasContent && (
            <button
              type="button"
              aria-label="More details"
              title="More details"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-accent text-accent-foreground shadow-sm transition hover:bg-accent-hover"
              onClick={() => setMaterialModalOpen(true)}
            >
              <IconMore />
            </button>
          )}
        </div>
      </div>
      {selectedInfo.meta && !infoCollapsed ? (
        <>
          {detailRows.length ? (
            <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface-elevated/95 shadow-sm">
              <table className="min-w-full table-fixed border-collapse text-xs">
                <tbody>
                  {detailRows.map((row, index) => (
                    <tr key={`${row.label}-${index}`} className={index % 2 === 1 ? "bg-surface/70" : "bg-surface-elevated"}>
                      <th
                        scope="row"
                        className="w-[45%] align-top border border-border px-3 py-2 text-left font-semibold uppercase tracking-wide text-text-muted"
                      >
                        {row.label}
                      </th>
                      {(() => {
                        const textAlign = row.align === "right" || (row.align !== "left" && (row.numeric || row.align === "end")) ? "text-right" : "text-left";
                        const extra = row.numeric || row.align === "right" ? "tabular-nums" : "";
                        return (
                          <td
                            className={`w-[55%] align-top border border-border px-3 py-2 text-text-primary ${textAlign} ${extra}`.trim()}
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
        </>
      ) : null}
    </div>
  ) : null;

  if (variant === "drawer") {
    const drawerShellClasses = `fixed inset-0 z-50 transition duration-200 ${
      open ? "pointer-events-auto" : "pointer-events-none"
    } ${className}`.trim();

    const overlayClasses = `absolute inset-0 bg-accent/40 backdrop-blur-sm transition-opacity duration-200 ${
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
            <div className="flex h-full flex-col overflow-hidden bg-surface-elevated shadow-xl ring-1 ring-border">
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

  // Panel variant renders as sidenav (no fixed positioning - App.jsx handles it)
  const panelWrapper = `flex flex-col h-full ${className}`.trim();

  return (
    <>
      <aside className={panelWrapper} aria-label="Scene Tree">
        <div className="flex flex-col overflow-hidden h-full">
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
