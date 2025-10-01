const DIAGNOSTIC_MODES = ["nonStrict", "strict"];

const DIAGNOSTIC_CONTEXT_FIELDS = [
  ["path", "Path"],
  ["objectPath", "Object path"],
  ["objectId", "Object"],
  ["resourceId", "Resource"],
  ["componentId", "Component"],
  ["meshId", "Mesh"],
  ["triangleIndex", "Triangle"],
  ["buildItemIndex", "Build item"],
  ["index", "Index"],
  ["uuid", "UUID"],
];

function pickDiagnosticCode(entry) {
  if (!entry || typeof entry !== "object") return null;
  return (
    entry.code ??
    entry.kind ??
    entry.errorCode ??
    entry.warningCode ??
    entry.index ??
    null
  );
}

function extractDiagnosticContext(entry) {
  if (!entry || typeof entry !== "object") return null;

  for (const [field, label] of DIAGNOSTIC_CONTEXT_FIELDS) {
    const value = entry[field];
    if (value === undefined || value === null || value === "") continue;
    return `${label}: ${value}`;
  }

  return null;
}

function groupDiagnostics(entries, { severity, mode }) {
  if (!Array.isArray(entries) || entries.length === 0) return [];

  const map = new Map();

  entries.forEach((entry) => {
    const message = (entry?.message || "").trim();
    const code = pickDiagnosticCode(entry);
    const key = `${severity}|${mode}|${code ?? ""}|${message}`;

    if (!map.has(key)) {
      map.set(key, {
        id: `${severity}-${mode}-${map.size + 1}`,
        severity,
        mode,
        count: 0,
        message,
        code,
        example: entry,
        context: extractDiagnosticContext(entry),
      });
    }

    const group = map.get(key);
    group.count += 1;
  });

  const groups = Array.from(map.values());

  groups.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    if (a.message !== b.message) return a.message.localeCompare(b.message);
    return (a.code ?? "").toString().localeCompare((b.code ?? "").toString());
  });

  return groups;
}

export function formatDiagnosticsForUi(
  diagnostics,
  { includeFullDetails = true, previewLimit = 10 } = {}
) {
  const source = diagnostics || {};
  const result = {
    totalWarnings: 0,
    totalErrors: 0,
    previewLimit: includeFullDetails ? null : previewLimit ?? null,
    hasSuppressedDetails: false,
    grouped: {
      warnings: [],
      errors: [],
    },
  };

  let suppressed = false;

  for (const mode of DIAGNOSTIC_MODES) {
    const modeData = source[mode] || {};
    const warnings = Array.isArray(modeData.warnings) ? modeData.warnings : [];
    const errors = Array.isArray(modeData.errors) ? modeData.errors : [];

    const warningCount = warnings.length;
    const errorCount = errors.length;

    result.totalWarnings += warningCount;
    result.totalErrors += errorCount;

    const warningGroups = groupDiagnostics(warnings, {
      severity: "warning",
      mode,
    });
    const errorGroups = groupDiagnostics(errors, {
      severity: "error",
      mode,
    });

    let warningsOut = warnings;
    let errorsOut = errors;
    let warningsTruncated = false;
    let errorsTruncated = false;

    if (!includeFullDetails) {
      const limit = typeof previewLimit === "number" && previewLimit > 0 ? previewLimit : 0;
      warningsOut = limit > 0 ? warnings.slice(0, limit) : [];
      errorsOut = limit > 0 ? errors.slice(0, limit) : [];
      warningsTruncated = warningCount > warningsOut.length;
      errorsTruncated = errorCount > errorsOut.length;
      if (warningsTruncated || errorsTruncated) {
        suppressed = true;
      }
    }

    result[mode] = {
      warnings: warningsOut,
      errors: errorsOut,
      warningCount,
      errorCount,
      warningsTruncated,
      errorsTruncated,
      warningGroups,
      errorGroups,
    };

    if (warningGroups.length) {
      result.grouped.warnings.push(
        ...warningGroups.map((group) => ({ ...group }))
      );
    }
    if (errorGroups.length) {
      result.grouped.errors.push(
        ...errorGroups.map((group) => ({ ...group }))
      );
    }
  }

  result.hasSuppressedDetails = suppressed;

  result.grouped.warnings.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    return a.message.localeCompare(b.message);
  });

  result.grouped.errors.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    return a.message.localeCompare(b.message);
  });

  return result;
}

export function integrateDiagnosticsIntoResult(
  baseResult,
  diagnostics,
  { suppressed = false } = {}
) {
  const metadata = { ...(baseResult?.metadata || {}) };
  metadata.diagnostics = diagnostics;
  metadata.diagnosticsSuppressed = Boolean(suppressed);
  metadata.diagnosticsPreviewLimit = suppressed
    ? diagnostics?.previewLimit ?? null
    : null;
  metadata.diagnosticsTotalWarnings = diagnostics?.totalWarnings ?? 0;
  metadata.diagnosticsTotalErrors = diagnostics?.totalErrors ?? 0;

  const report = { ...(baseResult?.report || {}) };
  report.diagnostics = diagnostics;

  return {
    ...baseResult,
    diagnostics,
    metadata,
    report,
  };
}
