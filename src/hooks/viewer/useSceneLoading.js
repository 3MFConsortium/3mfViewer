import { useCallback, useRef, useState } from "react";

import { formatDiagnosticsForUi, integrateDiagnosticsIntoResult } from "../../lib/diagnostics.js";

export const useSceneLoading = ({
  load3mf,
  ensureLib3mf,
  beamLatticeLinesOnly,
  specUrls,
  beginLoad,
  finishLoad,
  setLoadingScene,
  failLoad,
  setDiagnosticsNotice,
  setDiagnosticsNoticeOpen,
  setSpecUrls,
  setSpecResults,
  setSampleLoading,
  setSampleError,
  setDragActive,
  resetTransientUi,
  resetTransientSpecs,
  setMobileNavOpen,
}) => {
  const fileInputRef = useRef(null);
  const lastProgressRef = useRef({ triangles: 0, at: 0 });
  const [loadProgress, setLoadProgress] = useState(null);
  const [, setLoadTimings] = useState([]);
  const [loadStartMs, setLoadStartMs] = useState(null);
  const [loadRate, setLoadRate] = useState(null);
  const [loadLastUpdateMs, setLoadLastUpdateMs] = useState(null);
  const [loadStage, setLoadStage] = useState(null);

  const checkSpecifications = useCallback(
    async (urls) => {
      const normalized = Array.isArray(urls)
        ? urls.map((url) => url.trim()).filter(Boolean)
        : typeof urls === "string"
          ? [urls.trim()].filter(Boolean)
          : [];

      setSpecUrls(normalized);

      if (!normalized.length) {
        setSpecResults([]);
        return [];
      }

      let wrapper = null;
      try {
        const lib = await ensureLib3mf();
        wrapper = new lib.CWrapper();
        const results = normalized.map((url) => {
          const specData = {
            url,
            supported: false,
            major: null,
            minor: null,
            micro: null,
          };
          try {
            const spec = wrapper.GetSpecificationVersion(url);
            if (spec && typeof spec === "object") {
              const supportedValue =
                spec.IsSupported ??
                spec.isSupported ??
                spec.Supported ??
                spec.supported ??
                false;
              specData.supported = !!supportedValue;
              if (spec.Major !== undefined) specData.major = Number(spec.Major);
              if (spec.Minor !== undefined) specData.minor = Number(spec.Minor);
              if (spec.Micro !== undefined) specData.micro = Number(spec.Micro);
            }
          } catch (err) {
            console.warn("Failed to inspect specification", url, err);
          }
          return specData;
        });
        setSpecResults(results);
        return results;
      } catch (err) {
        console.error("Failed to check specifications", err);
        const fallback = normalized.map((url) => ({
          url,
          supported: false,
          major: null,
          minor: null,
          micro: null,
        }));
        setSpecResults(fallback);
        return fallback;
      } finally {
        try {
          wrapper?.delete?.();
        } catch {
          /* ignore */
        }
      }
    },
    [ensureLib3mf, setSpecResults, setSpecUrls]
  );

  const applyLoadedResult = useCallback(
    (rawResult, fileLabel) => {
      console.info("[viewer] applyLoadedResult", {
        file: fileLabel,
        meshes: rawResult?.meshCount ?? rawResult?.meshResources?.length,
        time: Date.now(),
      });
      const fullDiagnostics = formatDiagnosticsForUi(rawResult.diagnostics, {
        includeFullDetails: true,
      });

      const finalResult = integrateDiagnosticsIntoResult(rawResult, fullDiagnostics, {
        suppressed: false,
      });

      finishLoad(finalResult.group, finalResult);

      const totalWarnings = fullDiagnostics?.totalWarnings || 0;
      const totalErrors = fullDiagnostics?.totalErrors || 0;
      const effectiveFileLabel =
        fileLabel ||
        rawResult?.metadata?.fileName ||
        finalResult?.metadata?.fileName ||
        "model";

      if (totalErrors > 0) {
        setDiagnosticsNotice({
          fileName: effectiveFileLabel,
          warnings: totalWarnings,
          errors: totalErrors,
        });
        setDiagnosticsNoticeOpen(true);
      } else {
        setDiagnosticsNotice(null);
        setDiagnosticsNoticeOpen(false);
      }

      return finalResult;
    },
    [finishLoad, setDiagnosticsNotice, setDiagnosticsNoticeOpen]
  );

  const handleLoadSample = useCallback(
    async (sample) => {
      try {
        resetTransientUi();
        resetTransientSpecs();
        setSampleError(null);
        setSampleLoading(sample.name);
        setDragActive(false);
        setLoadProgress(null);
        setLoadTimings([]);
        setLoadStartMs(performance.now());
        setLoadStage(null);
        const fileLabel = sample.fileName || `${sample.name}.3mf`;
        beginLoad(fileLabel);

        const urls = Array.isArray(sample.urls) ? sample.urls : [sample.url || sample.urls];
        let arrayBuffer = null;
        for (const u of urls) {
          try {
            const res = await fetch(u, { mode: "cors" });
            if (!res.ok) continue;
            const buf = await res.arrayBuffer();
            if (buf && buf.byteLength > 0) {
              arrayBuffer = buf;
              break;
            }
          } catch {
            // try next url
          }
        }
        if (!arrayBuffer) {
          throw new Error("Unable to fetch sample file.");
        }

        const rawResult = await load3mf(arrayBuffer, fileLabel, {
          specificationUrls: specUrls,
          beamLatticeLinesOnly,
          onStream: (partial) => {
            if (!partial?.group) return;
            setLoadingScene(partial.group, partial);
          },
          onProgress: (progress) => {
            setLoadProgress((prev) => ({ ...prev, ...progress }));
            const now = performance.now();
            const last = lastProgressRef.current;
            if (last.at > 0 && progress.triangles >= last.triangles) {
              const deltaTri = progress.triangles - last.triangles;
              const deltaMs = now - last.at;
              if (deltaMs > 0) {
                setLoadRate(deltaTri / (deltaMs / 1000));
              }
            }
            lastProgressRef.current = { triangles: progress.triangles || 0, at: now };
            setLoadLastUpdateMs(now);
          },
          onMeshTiming: (timing) => {
            setLoadTimings((prev) => [...prev, timing]);
          },
          onStage: (stageInfo) => {
            setLoadStage(stageInfo);
          },
        });
        const processedResult = applyLoadedResult(rawResult, fileLabel);
        if (Array.isArray(processedResult.metadata?.specifications)) {
          setSpecResults(processedResult.metadata.specifications);
          setSpecUrls(processedResult.metadata.specifications.map((s) => s.url).filter(Boolean));
        }
      } catch (err) {
        console.error("Failed to load sample", err);
        const message = err?.message || "Unable to load sample.";
        setSampleError(message);
        failLoad(message);
        resetTransientSpecs();
      } finally {
        setSampleLoading(null);
        setLoadProgress(null);
        setLoadTimings([]);
        setLoadStartMs(null);
        setLoadRate(null);
        setLoadLastUpdateMs(null);
        setLoadStage(null);
        lastProgressRef.current = { triangles: 0, at: 0 };
      }
    },
    [
      beginLoad,
      failLoad,
      load3mf,
      setDragActive,
      specUrls,
      applyLoadedResult,
      resetTransientSpecs,
      resetTransientUi,
      setSampleError,
      setSampleLoading,
      setSpecResults,
      setSpecUrls,
      setLoadingScene,
      beamLatticeLinesOnly,
    ]
  );

  const loadFromArrayBuffer = useCallback(
    async (arrayBuffer, name, options = {}) => {
      if (!arrayBuffer) return;
      const fileName = name || "embedded.3mf";

      resetTransientUi();
      resetTransientSpecs();
      beginLoad(fileName);
      setMobileNavOpen(false);
      setLoadProgress(null);
      setLoadTimings([]);
      setLoadStartMs(performance.now());
      setLoadStage(null);

      try {
        if (!options.skipExtensionCheck && fileName) {
          const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
          if (extension && extension !== ".3mf") {
            throw new Error(`Unsupported file type: ${extension || "(unknown)"}`);
          }
        }

        const rawResult = await load3mf(arrayBuffer, fileName, {
          specificationUrls: specUrls,
          beamLatticeLinesOnly,
          onStream: (partial) => {
            if (!partial?.group) return;
            setLoadingScene(partial.group, partial);
          },
          onProgress: (progress) => {
            setLoadProgress((prev) => ({ ...prev, ...progress }));
            const now = performance.now();
            const last = lastProgressRef.current;
            if (last.at > 0 && progress.triangles >= last.triangles) {
              const deltaTri = progress.triangles - last.triangles;
              const deltaMs = now - last.at;
              if (deltaMs > 0) {
                setLoadRate(deltaTri / (deltaMs / 1000));
              }
            }
            lastProgressRef.current = { triangles: progress.triangles || 0, at: now };
            setLoadLastUpdateMs(now);
          },
          onMeshTiming: (timing) => {
            setLoadTimings((prev) => [...prev, timing]);
          },
          onStage: (stageInfo) => {
            setLoadStage(stageInfo);
          },
        });

        const processedResult = applyLoadedResult(rawResult, fileName);
        if (Array.isArray(processedResult.metadata?.specifications)) {
          setSpecResults(processedResult.metadata.specifications);
          setSpecUrls(processedResult.metadata.specifications.map((s) => s.url).filter(Boolean));
        }
        setLoadProgress(null);
        setLoadTimings([]);
        setLoadStartMs(null);
        setLoadRate(null);
        setLoadLastUpdateMs(null);
        setLoadStage(null);
        lastProgressRef.current = { triangles: 0, at: 0 };
      } catch (err) {
        console.error("Failed to load model", err);
        const message = err?.message || "Unable to load file.";
        failLoad(message);
        resetTransientSpecs();
        setLoadProgress(null);
        setLoadTimings([]);
        setLoadStartMs(null);
        setLoadRate(null);
        setLoadLastUpdateMs(null);
        setLoadStage(null);
        lastProgressRef.current = { triangles: 0, at: 0 };
      }
    },
    [
      load3mf,
      beginLoad,
      failLoad,
      setMobileNavOpen,
      specUrls,
      applyLoadedResult,
      resetTransientSpecs,
      resetTransientUi,
      setSpecResults,
      setSpecUrls,
      setLoadingScene,
      beamLatticeLinesOnly,
    ]
  );

  const handleLoadFile = useCallback(
    async (file) => {
      if (!file) return;
      const arrayBuffer = await file.arrayBuffer();
      await loadFromArrayBuffer(arrayBuffer, file.name);
    },
    [loadFromArrayBuffer]
  );

  const handleFileInputChange = useCallback(
    (event) => {
      const file = event.target.files && event.target.files[0];
      if (file) handleLoadFile(file);
      event.target.value = "";
    },
    [handleLoadFile]
  );

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    fileInputRef,
    loadProgress,
    loadStartMs,
    loadRate,
    loadLastUpdateMs,
    loadStage,
    handleLoadSample,
    loadFromArrayBuffer,
    handleLoadFile,
    handleFileInputChange,
    handleBrowseClick,
    checkSpecifications,
  };
};
