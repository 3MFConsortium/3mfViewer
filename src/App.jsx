/* global __APP_VERSION__ */

import React, {
  useMemo,
  useRef,
  useCallback,
  useEffect,
  useState,
} from "react";
import * as THREE from "three";

import { Modal } from "./components/ui/Modal.jsx";
import { ScenePreferences } from "./components/ui/ScenePreferences.jsx";
import { IconClose } from "./components/ui/Icons.jsx";
import { useRafFps } from "./hooks/useRafFps.js";
import releaseNotes from "./release-notes.json" with { type: "json" };
import { ReleaseNotesModal } from "./components/ui/ReleaseNotesModal.jsx";
import { ThreeMFLoaderProvider } from "./components/loaders/ThreeMFLoader.jsx";
import { useThreeMFLoader } from "./components/loaders/ThreeMFLoaderContext.js";
import { useViewerStore } from "./stores/viewerStore.js";
import { ViewerHome } from "./components/home/ViewerHome.jsx";
import { ViewerHud } from "./components/viewer/ViewerHud.jsx";
import { ViewerScene } from "./components/viewer/ViewerScene.jsx";
import { ViewerOverlays } from "./components/viewer/ViewerOverlays.jsx";
import { formatDiagnosticsForUi, integrateDiagnosticsIntoResult } from "./lib/diagnostics.js";

const STATUS_STYLES = {
  now: {
    dotClass: "bg-emerald-500",
    labelClass: "text-emerald-600",
    stateLabel: "Available",
  },
  progress: {
    dotClass: "bg-sky-400",
    labelClass: "text-sky-600",
    stateLabel: "In progress",
  },
  soon: {
    dotClass: "bg-amber-400",
    labelClass: "text-amber-600",
    stateLabel: "Planned",
  },
};

const getStatusMeta = (status) => STATUS_STYLES[status] || STATUS_STYLES.progress;

function ViewerApp() {
  const { load3mf, ensureLib3mf } = useThreeMFLoader();
  const sceneObject = useViewerStore((state) => state.viewer.sceneObject);
  const sceneData = useViewerStore((state) => state.viewer.sceneData);
  const loadStatus = useViewerStore((state) => state.viewer.loadStatus);
  const loadError = useViewerStore((state) => state.viewer.loadError);
  const loadedName = useViewerStore((state) => state.viewer.loadedName);
  const dragActive = useViewerStore((state) => state.viewer.dragActive);
  const showScene = !!sceneObject;
  const prefs = useViewerStore((state) => state.prefs);
  const openPrefs = useViewerStore((state) => state.ui.openPrefs);
  const isCoarsePointer = useViewerStore((state) => state.ui.isCoarsePointer);
  const viewportWidth = useViewerStore((state) => state.ui.viewportWidth);
  const dockVisited = useViewerStore((state) => state.ui.dockVisited);
  const openReleaseNotes = useViewerStore((state) => state.ui.openReleaseNotes);
  const releaseNotesTimelineOpen = useViewerStore((state) => state.ui.releaseNotesTimelineOpen);
  const sampleLoading = useViewerStore((state) => state.specs.sampleLoading);
  const sampleError = useViewerStore((state) => state.specs.sampleError);
  const specUrls = useViewerStore((state) => state.specs.specUrls);
  const diagnosticsNotice = useViewerStore((state) => state.specs.diagnosticsNotice);
  const diagnosticsNoticeOpen = useViewerStore((state) => state.specs.diagnosticsNoticeOpen);
  const setDragActive = useViewerStore((state) => state.setDragActive);
  const beginLoad = useViewerStore((state) => state.beginLoad);
  const finishLoad = useViewerStore((state) => state.finishLoad);
  const setLoadingScene = useViewerStore((state) => state.setLoadingScene);
  const failLoad = useViewerStore((state) => state.failLoad);
  const clearScene = useViewerStore((state) => state.clearScene);
  const setPrefs = useViewerStore((state) => state.setPrefs);
  const setOpenPrefs = useViewerStore((state) => state.setOpenPrefs);
  const restorePrefs = useViewerStore((state) => state.restorePrefs);
  const setIsCoarsePointer = useViewerStore((state) => state.setIsCoarsePointer);
  const setViewportWidth = useViewerStore((state) => state.setViewportWidth);
  const setDockHintActive = useViewerStore((state) => state.setDockHintActive);
  const setDockCueActive = useViewerStore((state) => state.setDockCueActive);
  const setSampleLoading = useViewerStore((state) => state.setSampleLoading);
  const setSampleError = useViewerStore((state) => state.setSampleError);
  const setSpecUrls = useViewerStore((state) => state.setSpecUrls);
  const setSpecResults = useViewerStore((state) => state.setSpecResults);
  const setDiagnosticsNotice = useViewerStore((state) => state.setDiagnosticsNotice);
  const setDiagnosticsNoticeOpen = useViewerStore((state) => state.setDiagnosticsNoticeOpen);
  const setOpenReleaseNotes = useViewerStore((state) => state.setOpenReleaseNotes);
  const setReleaseNotesTimelineOpen = useViewerStore((state) => state.setReleaseNotesTimelineOpen);
  const resetTransientUi = useViewerStore((state) => state.resetTransientUi);
  const resetTransientSpecs = useViewerStore((state) => state.resetTransientSpecs);
  const dragDepthRef = useRef(0);
  const fileInputRef = useRef(null);
  const [canvasElement, setCanvasElement] = useState(null);
  const [loadProgress, setLoadProgress] = useState(null);
  const [loadTimings, setLoadTimings] = useState([]);
  const [loadStartMs, setLoadStartMs] = useState(null);
  const [loadRate, setLoadRate] = useState(null);
  const [loadLastUpdateMs, setLoadLastUpdateMs] = useState(null);
  const [loadStage, setLoadStage] = useState(null);
  const lastProgressRef = useRef({ triangles: 0, at: 0 });
  const helpButtonRef = useRef(null);
  const helpCardRef = useRef(null);
  const fps = useRafFps({ sample: 750 });
  const hiddenMeshIds = useViewerStore((state) => state.selection.hiddenMeshIds);
  const toggleMeshVisibility = useViewerStore((state) => state.toggleMeshVisibility);
  const selectedNodeId = useViewerStore((state) => state.selection.selectedNodeId);
  const selectedNodeInfo = useViewerStore((state) => state.selection.selectedNodeInfo);
  const setSelectedNode = useViewerStore((state) => state.setSelectedNode);
  const mobileDockOpen = useViewerStore((state) => state.ui.mobileDockOpen);
  const setMobileNavOpen = useViewerStore((state) => state.setMobileNavOpen);
  const setMobileDockOpen = useViewerStore((state) => state.setMobileDockOpen);
  const helpCardOpen = useViewerStore((state) => state.ui.helpCardOpen);
  const setHelpCardOpen = useViewerStore((state) => state.setHelpCardOpen);
  const toggleHelpCard = useViewerStore((state) => state.toggleHelpCard);
  const tabletDockCollapsed = useViewerStore((state) => state.ui.tabletDockCollapsed);
  const setTabletDockCollapsed = useViewerStore((state) => state.setTabletDockCollapsed);
  const handleSelectNode = useCallback(
    (node) => {
      setSelectedNode(node);
    },
    [setSelectedNode]
  );

  // ---------- samples & home content ----------

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

  const sampleModels = useMemo(
    () => [
      {
        name: "Cube",
        fileName: "cube.3mf",
        urls: ["/data/cube.3mf"],
        badge: "Components",
        description: "Component assembly with transforms and shared meshes.",
      },
      {
        name: "Helix",
        fileName: "helix.3mf",
        urls: ["/data/helix.3mf"],
        badge: "Basics",
        description: "Minimal geometry to check navigation, scaling, and lighting.",
      },
      {
        name: "Parts for Bounding Box",
        fileName: "PartsForBoundingBox.3mf",
        urls: ["/data/PartsForBoundingBox.3mf"],
        badge: "Colour group",
        description: "Two-part assembly coloured via a 3MF colour group (orange + grey).",
      },
      {
        name: "Pyramid with Properties",
        fileName: "PyramidWithProperties.3mf",
        urls: ["/data/PyramidWithProperties.3mf"],
        badge: "Material group",
        description: "Demonstrates base material groups assigning different faces per material.",
      },
      {
        name: "Colour Cube",
        fileName: "colorcube.3mf",
        urls: ["/data/colorcube.3mf"],
        badge: "Vertex colours",
        description: "Single mesh with a smooth vertex-colour gradient across the cube.",
      },
      {
        name: "Sliced Cube",
        fileName: "P_SXX_0101_03.3mf",
        urls: ["/data/slice/P_SXX_0101_03.3mf"],
        badge: "Slice extension",
        description: "Cube with slice stack data for layer-by-layer visualization.",
      },
    ],
    []
  );

  const renderingRoadmap = useMemo(() => {
    const features = [
      { label: "Mesh geometry", status: "now" },
      { label: "Properties", status: "now" },
      { label: "Colors", status: "now" },
      { label: "Textures", status: "now" },
      { label: "Slice extension", status: "now" },
      { label: "Beam lattice extension", status: "soon" },
      { label: "Volumetric extension", status: "soon" },
    ];

    return [
      {
        label: "Core 3MF specification",
        items: features.slice(0, 4),
      },
      ...features.slice(4),
    ];
  }, []);

  const upcomingCards = useMemo(
    () => [
      {
        title: "Converter",
        caption: "Common formats to 3MF",
        status: "Planned",
      },
      {
        title: "Validator",
        caption: "Spec compliance checks",
        status: "Live – diagnostics in scene tree",
      },
    ],
    []
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
          setSpecUrls(
            processedResult.metadata.specifications.map((s) => s.url).filter(Boolean)
          );
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
    ]
  );

  // ---------- scene prefs ----------
  // ---------- tree data ----------
  const treeItems = useMemo(() => {
    if (sceneData?.meshResources?.length && sceneData?.items?.length) {
      const meshMap = new Map(
        sceneData.meshResources.map((resource) => [resource.resourceId, resource])
      );
      const componentMap = new Map(
        (sceneData.componentResources || []).map((resource) => [resource.resourceId, resource])
      );

      const buildMeshNode = (resource, context) => {
        const instanceKey = context.instanceKey ?? String(resource.resourceId);
        const id = `mesh-${resource.resourceId}-${instanceKey}`;
        const meta = {
          vertexCount: resource.vertexCount,
          triangleCount: resource.triangleCount,
          resourceId: resource.resourceId,
          uniqueResourceId: resource.uniqueResourceId ?? null,
          uuid: resource.uuid ?? null,
          hasUUID: resource.hasUUID ?? false,
          meshDiagnostics: resource.meshSummary,
          materialColorStats: resource.materialColorStats,
          objectLevelProperty: resource.objectLevelProperty,
          buildItemIndex: context.buildItemIndex,
          buildItemUuid: context.buildItemUuid ?? null,
          resourceUuid: context.resourceUuid ?? null,
        };
        if (Array.isArray(context.metadataEntries) && context.metadataEntries.length) {
          meta.metadataEntries = context.metadataEntries;
        }
        if (context.transform43) {
          meta.transforms = [
            {
              label: context.transformLabel || `Build item ${context.buildItemIndex ?? ""}`.trim(),
              matrix4x3: context.transform43,
            },
          ];
        }
        return {
          id,
          visibilityId: String(resource.resourceId),
          name: resource.displayName || resource.name || `Mesh ${resource.resourceId ?? "?"}`,
          type: "mesh",
          isOpenByDefault: false,
          children: [],
          meta,
        };
      };

      const buildComponentNode = (resource, context, visited) => {
        const instanceKey = context.instanceKey ?? String(resource.resourceId);
        const id = `group-${resource.resourceId}-${instanceKey}`;
        const meta = {
          resourceId: resource.resourceId,
          uniqueResourceId: resource.uniqueResourceId ?? null,
          uuid: resource.uuid ?? null,
          hasUUID: resource.hasUUID ?? false,
          buildItemIndex: context.buildItemIndex,
          buildItemUuid: context.buildItemUuid ?? null,
          resourceUuid: context.resourceUuid ?? null,
          components: resource.components?.map((component) => ({
            index: component.index,
            targetId: component.targetId,
            hasTransform: component.hasTransform,
            transform4x3: component.transform4x3,
            uuid: component.uuid ?? null,
            hasUUID: component.hasUUID ?? false,
          })),
        };
        if (Array.isArray(context.metadataEntries) && context.metadataEntries.length) {
          meta.metadataEntries = context.metadataEntries;
        }
        if (context.transform43) {
          meta.transforms = [
            {
              label: context.transformLabel || `Build item ${context.buildItemIndex ?? ""}`.trim(),
              matrix4x3: context.transform43,
            },
          ];
        }

        const children = [];
        resource.components?.forEach((component) => {
          if (visited.has(component.targetId)) return;
          const child = buildResourceNode(
            component.targetId,
            {
              ...context,
              instanceKey: `${instanceKey}-${component.index}`,
              metadataEntries: undefined,
              transform43: component.transform4x3,
              transformLabel: component.hasTransform
                ? `${resource.displayName || "Component"} · ${component.index}`
                : `${resource.displayName || "Component"} · ${component.index} (identity)`,
              componentPath: [
                ...(context.componentPath || []),
                {
                  resourceId: resource.resourceId,
                  componentIndex: component.index,
                  resourceUuid: resource.uuid ?? null,
                  componentUuid: component.uuid ?? null,
                },
              ],
            },
            visited
          );
          if (child) children.push(child);
        });

        return {
          id,
          name: resource.displayName || resource.name || `Component ${resource.resourceId ?? "?"}`,
          type: "group",
          isOpenByDefault: true,
          children,
          meta,
        };
      };

      const buildResourceNode = (resourceId, context = {}, visited = new Set()) => {
        if (meshMap.has(resourceId)) {
          return buildMeshNode(meshMap.get(resourceId), context);
        }
        if (componentMap.has(resourceId)) {
          if (visited.has(resourceId)) return null;
          visited.add(resourceId);
          const node = buildComponentNode(componentMap.get(resourceId), context, visited);
          visited.delete(resourceId);
          return node;
        }
        return null;
      };

      return sceneData.items
        .map((item) =>
          buildResourceNode(item.resourceId, {
            buildItemIndex: item.index,
            buildItemUuid: item.uuid ?? null,
            metadataEntries: item.metadata,
            transform43: item.transform,
            transformLabel: item.transform ? `Build item ${item.index}` : null,
            instanceKey: `item-${item.index}`,
            resourceUuid: item.objectUUID ?? null,
            componentPath: [],
          })
        )
        .filter(Boolean);
    }

    if (!sceneObject) return [];

    const toTreeNode = (obj, isRoot = false) => {
      const children = (obj.children || [])
        .map((child) => toTreeNode(child, false))
        .filter(Boolean);

      const type = obj.isMesh ? "mesh" : obj.isLight ? "light" : "group";
      const name = obj.name || (obj.isMesh ? "Mesh" : obj.type);

      if (!obj.isMesh && children.length === 0 && !isRoot) return null;

      const meta = {};
      if (obj.isMesh) {
        if (typeof obj.userData?.vertexCount === "number") {
          meta.vertexCount = obj.userData.vertexCount;
        }
        if (typeof obj.userData?.triangleCount === "number") {
          meta.triangleCount = obj.userData.triangleCount;
        }
        if (obj.userData?.baseColor) {
          meta.color = obj.userData.baseColor;
        }
        if (obj.userData?.resourceId !== undefined) {
          meta.resourceId = obj.userData.resourceId;
        }
        if (obj.userData?.uniqueResourceId !== undefined) {
          meta.uniqueResourceId = obj.userData.uniqueResourceId;
        }
        if (obj.userData?.uuid) {
          meta.uuid = obj.userData.uuid;
        }
        if (obj.userData?.buildItemUuid) {
          meta.buildItemUuid = obj.userData.buildItemUuid;
        }
        if (obj.userData?.hasUUID !== undefined) {
          meta.hasUUID = obj.userData.hasUUID;
        }
        if (Array.isArray(obj.userData?.metadataEntries) && obj.userData.metadataEntries.length) {
          meta.metadataEntries = obj.userData.metadataEntries;
        }
        if (obj.userData?.meshDiagnostics) {
          meta.meshDiagnostics = obj.userData.meshDiagnostics;
        }
        if (Array.isArray(obj.userData?.components) && obj.userData.components.length) {
          meta.components = obj.userData.components;
        }
        if (Array.isArray(obj.userData?.transforms) && obj.userData.transforms.length) {
          meta.transforms = obj.userData.transforms;
        }
        if (Array.isArray(obj.userData?.materialResourceIds) && obj.userData.materialResourceIds.length) {
          meta.materialResourceIds = obj.userData.materialResourceIds;
        }
        if (obj.userData?.materialColorStats) {
          meta.materialColorStats = obj.userData.materialColorStats;
        }
        if (obj.userData?.objectLevelProperty) {
          meta.objectLevelProperty = obj.userData.objectLevelProperty;
        }
      } else {
        meta.childCount = children.length;
        if (obj.userData?.resourceId !== undefined) {
          meta.resourceId = obj.userData.resourceId;
        }
        if (obj.userData?.uniqueResourceId !== undefined) {
          meta.uniqueResourceId = obj.userData.uniqueResourceId;
        }
        if (obj.userData?.uuid) {
          meta.uuid = obj.userData.uuid;
        }
        if (obj.userData?.buildItemUuid) {
          meta.buildItemUuid = obj.userData.buildItemUuid;
        }
        if (obj.userData?.hasUUID !== undefined) {
          meta.hasUUID = obj.userData.hasUUID;
        }
        if (Array.isArray(obj.userData?.metadataEntries) && obj.userData.metadataEntries.length) {
          meta.metadataEntries = obj.userData.metadataEntries;
        }
        if (Array.isArray(obj.userData?.components) && obj.userData.components.length) {
          meta.components = obj.userData.components;
        }
        if (Array.isArray(obj.userData?.transforms) && obj.userData.transforms.length) {
          meta.transforms = obj.userData.transforms;
        }
      }

      return {
        id: obj.uuid,
        name,
        type,
        isOpenByDefault: type === "group",
        children,
        meta,
      };
    };

    return [toTreeNode(sceneObject, true)].filter(Boolean);
  }, [sceneData, sceneObject]);

  const sceneBounds = useMemo(() => {
    if (!sceneObject) return null;
    const box = new THREE.Box3().setFromObject(sceneObject);
    if (box.isEmpty()) return null;
    const size = box.getSize(new THREE.Vector3());
    const maxExtent = Math.max(size.x, size.y, size.z, 1);
    return {
      size,
      maxExtent,
      min: box.min.clone(),
    };
  }, [sceneObject]);

  const sliceMax = useMemo(() => {
    const stacks = sceneData?.sliceStacks ?? [];
    if (!stacks.length) return -1;
    const max = stacks.reduce((acc, stack) => {
      const count = Number(stack?.sliceCount ?? 0);
      return Number.isFinite(count) ? Math.max(acc, count) : acc;
    }, 0);
    return max > 0 ? max - 1 : -1;
  }, [sceneData]);

  useEffect(() => {
    if (!sceneObject) return;
    const sliceViewActive = prefs.sliceIndex >= 0;
    const targetSlice = prefs.sliceIndex;

    sceneObject.traverse((child) => {
      if (child?.isMesh && !child.userData?.isSliceLine) {
        const material = child.material;
        if (!material) return;
        if (sliceViewActive) {
          if (!child.userData.originalMaterial) {
            child.userData.originalMaterial = {
              transparent: material.transparent,
              opacity: material.opacity,
              depthWrite: material.depthWrite,
            };
          }
          material.transparent = true;
          material.opacity = 0.15;
          material.depthWrite = false;
          material.needsUpdate = true;
        } else if (child.userData.originalMaterial) {
          const original = child.userData.originalMaterial;
          material.transparent = original.transparent;
          material.opacity = original.opacity;
          material.depthWrite = original.depthWrite;
          material.needsUpdate = true;
          delete child.userData.originalMaterial;
        }
      }

      if (child?.userData?.isSliceLine) {
        child.visible = sliceViewActive && child.userData.sliceIndex === targetSlice;
      }
    });
  }, [sceneObject, prefs.sliceIndex, sliceMax]);

  // ---------- refs ----------
  const controlsRef = useRef(null);
  const contentRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const fitRafRef = useRef(0);

  const handleLoadFile = useCallback(
    async (file) => {
      if (!file) return;

      resetTransientUi();
      resetTransientSpecs();
      beginLoad(file.name);
      setMobileNavOpen(false);
      setLoadProgress(null);
      setLoadTimings([]);
      setLoadStartMs(performance.now());
      setLoadStage(null);

      try {
        const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
        if (extension !== ".3mf") {
          throw new Error(`Unsupported file type: ${extension || "(unknown)"}`);
        }

        const arrayBuffer = await file.arrayBuffer();
        const rawResult = await load3mf(arrayBuffer, file.name, {
          specificationUrls: specUrls,
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

        const processedResult = applyLoadedResult(rawResult, file.name);
        if (Array.isArray(processedResult.metadata?.specifications)) {
          setSpecResults(processedResult.metadata.specifications);
          setSpecUrls(
            processedResult.metadata.specifications.map((s) => s.url).filter(Boolean)
          );
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
    ]
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



  const handleBackToStart = useCallback(() => {
    resetTransientUi();
    resetTransientSpecs();
    clearScene();
  }, [clearScene, resetTransientSpecs, resetTransientUi]);

  const handleToggleGrid = useCallback(() => {
    setPrefs((p) => ({ ...p, grid: !p.grid }));
  }, [setPrefs]);

  const handleToggleGround = useCallback(() => {
    setPrefs((p) => ({ ...p, ground: !p.ground }));
  }, [setPrefs]);

  const handleToggleStats = useCallback(() => {
    setPrefs((p) => ({ ...p, showStats: !p.showStats }));
  }, [setPrefs]);

  const handleToggleShadows = useCallback(() => {
    setPrefs((p) => ({ ...p, shadows: !p.shadows }));
  }, [setPrefs]);

  const handleToggleWireframe = useCallback(
    (enabled) => {
      setPrefs((p) => ({ ...p, wireframe: enabled, edges: enabled ? false : p.edges }));
    },
    [setPrefs]
  );

  const handleToggleEdges = useCallback(
    (enabled) => {
      setPrefs((p) => ({ ...p, edges: enabled, wireframe: enabled ? false : p.wireframe }));
    },
    [setPrefs]
  );


  useEffect(() => {
    const prevent = (event) => {
      event.preventDefault();
      event.stopPropagation();
    };

    const handleDragEnter = (event) => {
      prevent(event);
      dragDepthRef.current += 1;
      if (event.dataTransfer?.types?.includes("Files")) {
        setDragActive(true);
      }
    };

    const handleDragOver = (event) => {
      prevent(event);
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      setDragActive(true);
    };

    const handleDragLeave = (event) => {
      prevent(event);
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setDragActive(false);
      }
    };

    const handleDrop = (event) => {
      prevent(event);
      dragDepthRef.current = 0;
      setDragActive(false);
      const files = event.dataTransfer?.files;
      if (files && files.length > 0) {
        handleLoadFile(files[0]);
      }
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
    };
  }, [handleLoadFile, setDragActive]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;

    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setIsCoarsePointer(mq.matches);
    update();

    if (mq.addEventListener) mq.addEventListener("change", update);
    else mq.addListener(update);

    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", update);
      else mq.removeListener(update);
    };
  }, [setIsCoarsePointer]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleResize = () => setViewportWidth(window.innerWidth);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setViewportWidth]);

  // for reset view
  const initialCamPos = useRef(new THREE.Vector3(6, 5, 8));
  const initialTarget = useRef(new THREE.Vector3(0, 0, 0));

  // live background
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.setClearColor(new THREE.Color(prefs.background), 1.0);
    }
  }, [prefs.background]);

  // ---------- camera helpers ----------
  const DOLLY_STEP = 1.2;
  const handleZoomIn = useCallback(() => {
    controlsRef.current?.dollyOut(DOLLY_STEP);
  }, []);
  const handleZoomOut = useCallback(() => {
    controlsRef.current?.dollyIn(DOLLY_STEP);
  }, []);

  const handleFit = useCallback(() => {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    const content = contentRef.current;
    if (!controls || !camera || !content) return;

    const box = new THREE.Box3().setFromObject(content);
    if (box.isEmpty()) return;

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxSize = Math.max(size.x, size.y, size.z);
    const fitH = maxSize / (2 * Math.atan((Math.PI * camera.fov) / 360));
    const fitW = fitH / camera.aspect;
    const distance = 1.2 * Math.max(fitH, fitW);
    const direction = new THREE.Vector3()
      .subVectors(camera.position, controls.target)
      .normalize();

    controls.target.copy(center);
    camera.position.copy(center).addScaledVector(direction, distance);
    camera.near = distance / 100;
    camera.far = distance * 100;
    camera.updateProjectionMatrix();
    controls.update();
  }, []);

  const handleResetView = useCallback(() => {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    if (!controls || !camera) return;
    controls.target.copy(initialTarget.current);
    camera.position.copy(initialCamPos.current);
    camera.near = 0.1;
    camera.far = 1000;
    camera.updateProjectionMatrix();
    controls.update();
  }, []);

  // ---- PAN (FOV/zoom aware) ----
  const panByPixels = useCallback((dxPx, dyPx) => {
    const controls = controlsRef.current;
    const camera = cameraRef.current;
    const r = rendererRef.current;
    if (!controls || !camera || !r) return;

    const distance = camera.position.distanceTo(controls.target);
    const fovRad = (camera.fov * Math.PI) / 180;
    const viewportH = 2 * Math.tan(fovRad / 2) * distance;
    const viewportW = viewportH * camera.aspect;

    const moveX = (dxPx / r.domElement.clientWidth) * viewportW;
    const moveY = (dyPx / r.domElement.clientHeight) * viewportH;

    const xAxis = new THREE.Vector3()
      .setFromMatrixColumn(camera.matrix, 0)
      .multiplyScalar(-moveX);
    const yAxis = new THREE.Vector3()
      .setFromMatrixColumn(camera.matrix, 1)
      .multiplyScalar(moveY);
    const delta = xAxis.add(yAxis);

    camera.position.add(delta);
    controls.target.add(delta);
    controls.update();
  }, []);

  const PAN_STEP = 64;
  const panLeft = useCallback(() => panByPixels(-PAN_STEP, 0), [panByPixels]);
  const panRight = useCallback(() => panByPixels(PAN_STEP, 0), [panByPixels]);
  const panUp = useCallback(() => panByPixels(0, -PAN_STEP), [panByPixels]);
  const panDown = useCallback(() => panByPixels(0, PAN_STEP), [panByPixels]);

  const triggerFit = useCallback(() => {
    cancelAnimationFrame(fitRafRef.current);

    const attemptFit = () => {
      const controls = controlsRef.current;
      const camera = cameraRef.current;
      const content = contentRef.current;

      if (!sceneObject || !controls || !camera || !content) {
        fitRafRef.current = requestAnimationFrame(attemptFit);
        return;
      }

      handleFit();
      if (controlsRef.current && cameraRef.current) {
        initialTarget.current.copy(controlsRef.current.target);
        initialCamPos.current.copy(cameraRef.current.position);
      }
    };

    fitRafRef.current = requestAnimationFrame(attemptFit);
  }, [handleFit, sceneObject]);

  useEffect(() => {
    if (!sceneObject) {
      cancelAnimationFrame(fitRafRef.current);
      return undefined;
    }
    if (loadStatus === "loading" && !sceneObject.userData?.streamingReady) {
      cancelAnimationFrame(fitRafRef.current);
      return undefined;
    }
    triggerFit();
    return () => cancelAnimationFrame(fitRafRef.current);
  }, [sceneObject, loadStatus, triggerFit]);

  // Arrow keys: keep keyboard panning even without on-screen D-pad
  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "ArrowLeft") {
        panLeft();
        e.preventDefault();
      } else if (e.key === "ArrowRight") {
        panRight();
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        panUp();
        e.preventDefault();
      } else if (e.key === "ArrowDown") {
        panDown();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [panLeft, panRight, panUp, panDown]);

  // screenshot
  const handleScreenshot = useCallback(() => {
    const r = rendererRef.current;
    if (!r) return;
    requestAnimationFrame(() => {
      try {
        const url = r.domElement.toDataURL("image/png");
        const a = document.createElement("a");
        a.href = url;
        a.download = `threemfviewer_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch (e) {
        console.error("Screenshot failed", e);
      }
    });
  }, []);

  const showSceneTree = showScene && prefs.uiSceneTree;
  const showBottomBar = showScene && prefs.uiBottomControls;
  const helpAvailable = showScene && prefs.uiHelperMessage;

  const pageHeightClass = showScene ? "h-screen" : "min-h-screen";


  const helpItems = isCoarsePointer
    ? [
      "Drag with one finger to orbit",
      "Pinch with two fingers to zoom",
      "Two-finger drag to pan",
      "Double tap to fit the model",
      "Two-finger tap to reset view",
    ]
    : [
      "Drag with mouse to orbit",
      "Shift + drag to pan",
      "Scroll to zoom",
      "Arrow keys to pan",
      "Use toolbar buttons for fit/reset",
    ];
  const coarseTabletBreakpoint = 1024;
  const showTouchFab = isCoarsePointer && viewportWidth < coarseTabletBreakpoint;
  const showTouchTabletFull = isCoarsePointer && viewportWidth >= coarseTabletBreakpoint;

  const viewerControls = useMemo(() => ({
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onFit: handleFit,
    onResetView: handleResetView,
    onScreenshot: handleScreenshot,
    gridOn: prefs.grid,
    groundOn: prefs.ground,
    statsOn: prefs.showStats,
    shadowsOn: prefs.shadows,
    onToggleGrid: () => setPrefs(p => ({ ...p, grid: !p.grid })),
    onToggleGround: () => setPrefs(p => ({ ...p, ground: !p.ground })),
    onToggleStats: () => setPrefs(p => ({ ...p, showStats: !p.showStats })),
    onToggleShadows: () => setPrefs(p => ({ ...p, shadows: !p.shadows })),
    wireframeOn: prefs.wireframe,
    edgesOn: prefs.edges,
    onToggleWireframe: () => setPrefs(p => ({ ...p, wireframe: !p.wireframe })),
    onToggleEdges: () => setPrefs(p => ({ ...p, edges: !p.edges })),
  }), [handleZoomIn, handleZoomOut, handleFit, handleResetView, handleScreenshot, prefs, setPrefs]);

  const heroHeading = !isCoarsePointer && dragActive
    ? "Release to load"
    : loadStatus === "loading"
      ? "Loading 3MF…"
      : isCoarsePointer
        ? "Load a 3MF to get started"
        : "Drag & drop a 3MF to get started";

  const heroSubtext = !isCoarsePointer && dragActive
    ? "We’ll pull the mesh directly from the file."
    : loadStatus === "loading"
      ? "Hold tight while we extract meshes."
      : isCoarsePointer
        ? "Use the button below to choose a .3mf file from your device."
        : "Prefer browsing your drive?";

  const dropHint = isCoarsePointer
    ? "Use Browse to pick a .3mf file from your device."
    : "Or drop a .3mf anywhere in this window.";

  const homeBackgroundClass = dragActive
    ? "bg-gradient-to-br from-sky-50 via-sky-100 to-white text-slate-800"
    : "bg-gradient-to-br from-white via-slate-50 to-sky-50 text-slate-800";

  const browseButtonClass =
    loadStatus === "loading"
      ? "cursor-progress bg-white/30 text-white/70"
      : "bg-gradient-to-r from-sky-500 via-sky-600 to-violet-500 text-white shadow-sky-500/30 ring-1 ring-sky-500/40 hover:from-sky-600 hover:via-sky-700 hover:to-violet-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500";

  const progressPercent = loadProgress?.totalTriangles
    ? Math.min(100, Math.round((loadProgress.triangles / loadProgress.totalTriangles) * 100))
    : null;
  const progressLabel = loadProgress?.currentResourceName
    ? `Loading ${loadProgress.currentResourceName}`
    : `Loading ${loadedName || "3MF"}`;
  const progressSubLabel = loadProgress?.resourceTotal
    ? `Mesh ${loadProgress.resourceIndex} of ${loadProgress.resourceTotal}${loadProgress?.isTextured ? " • Textured mesh (slower)" : ""}`
    : loadStage?.detail || "Parsing 3MF + building task list…";
  const formatElapsed = (elapsedMs) => {
    if (!Number.isFinite(elapsedMs)) return "0s";
    const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
  };
  const elapsedLabel = loadStartMs ? formatElapsed(performance.now() - loadStartMs) : "0s";
  const rateLabel = loadRate
    ? `${Math.round(loadRate).toLocaleString()} tri/s`
    : null;
  const lastUpdateLabel = loadLastUpdateMs
    ? formatElapsed(performance.now() - loadLastUpdateMs)
    : null;

  useEffect(() => {
    if (!showSceneTree) {
      setMobileNavOpen(false);
    }
  }, [showSceneTree, setMobileNavOpen]);

  useEffect(() => {
    if (!showScene) {
      setCanvasElement(null);
      setMobileNavOpen(false);
    }
  }, [showScene, setMobileNavOpen]);

  useEffect(() => {
    if (!showBottomBar || !isCoarsePointer) {
      setMobileDockOpen(false);
    }
  }, [showBottomBar, isCoarsePointer, setMobileDockOpen]);

  useEffect(() => {
    if (!showTouchFab) {
      setMobileDockOpen(false);
    }
  }, [showTouchFab, setMobileDockOpen]);

  useEffect(() => {
    if (!showTouchTabletFull) {
      setTabletDockCollapsed(false);
    }
  }, [showTouchTabletFull, setTabletDockCollapsed]);

  useEffect(() => {
    if (!helpAvailable) {
      setHelpCardOpen(false);
    }
  }, [helpAvailable, setHelpCardOpen]);

  useEffect(() => {
    if (!canvasElement) return undefined;

    let lastSingleTap = 0;
    let multiTapStart = 0;
    let multiTapActive = false;

    const handleTouchStart = (event) => {
      if (event.touches.length >= 2) {
        multiTapStart = performance.now();
        multiTapActive = true;
      }
    };

    const handleTouchEnd = (event) => {
      const now = performance.now();

      if (multiTapActive && event.touches.length === 0) {
        if (event.changedTouches.length >= 2 && now - multiTapStart < 280) {
          handleResetView();
        }
        multiTapActive = false;
        return;
      }

      if (event.changedTouches.length === 1 && event.touches.length === 0) {
        if (now - lastSingleTap < 320) {
          handleFit();
          lastSingleTap = 0;
        } else {
          lastSingleTap = now;
        }
      }
    };

    canvasElement.addEventListener("touchstart", handleTouchStart, { passive: true });
    canvasElement.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      canvasElement.removeEventListener("touchstart", handleTouchStart);
      canvasElement.removeEventListener("touchend", handleTouchEnd);
    };
  }, [canvasElement, handleFit, handleResetView]);

  useEffect(() => {
    if (!mobileDockOpen) return undefined;
    const handleKey = (event) => {
      if (event.key === "Escape") setMobileDockOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [mobileDockOpen, setMobileDockOpen]);

  useEffect(() => {
    if (dockVisited) {
      setDockHintActive(false);
      return undefined;
    }
    if (showTouchFab || (showTouchTabletFull && tabletDockCollapsed)) {
      setDockHintActive(true);
    } else {
      setDockHintActive(false);
    }
    return undefined;
  }, [
    showTouchFab,
    showTouchTabletFull,
    tabletDockCollapsed,
    dockVisited,
    setDockHintActive,
  ]);

  useEffect(() => {
    if (mobileDockOpen) {
      setDockCueActive(true);
      const timer = window.setTimeout(() => setDockCueActive(false), 2000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [mobileDockOpen, setDockCueActive]);

  useEffect(() => {
    if (showTouchTabletFull && !tabletDockCollapsed) {
      setDockCueActive(true);
      const timer = window.setTimeout(() => setDockCueActive(false), 2000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [showTouchTabletFull, tabletDockCollapsed, setDockCueActive]);

  useEffect(() => {
    if (!helpCardOpen) return undefined;

    const handlePointer = (event) => {
      const target = event.target;
      if (
        helpCardRef.current?.contains(target) ||
        helpButtonRef.current?.contains(target)
      ) {
        return;
      }
      setHelpCardOpen(false);
    };

    const handleKey = (event) => {
      if (event.key === "Escape") setHelpCardOpen(false);
    };

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("touchstart", handlePointer);
    window.addEventListener("keydown", handleKey);

    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("touchstart", handlePointer);
      window.removeEventListener("keydown", handleKey);
    };
  }, [helpCardOpen, setHelpCardOpen]);

  const groundSize = sceneBounds ? Math.max(sceneBounds.maxExtent * 2.5, 20) : 20;
  const groundY = sceneBounds ? sceneBounds.min.y - 0.01 : -1;
  const gridDivisions = Math.min(Math.max(Math.round(groundSize), 24), 240);

  const appVersion = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev";
  const currentNotes = Array.isArray(releaseNotes?.[appVersion]) ? releaseNotes[appVersion] : null;

  return (
    <div
      className={`relative ${pageHeightClass} w-full overflow-x-hidden transition-colors duration-200 ${dragActive ? "bg-sky-50" : "bg-slate-50"}`}
    >
      {loadStatus === "loading" && (
        <div
          className="fixed inset-0 z-50"
          onWheel={(event) => event.preventDefault()}
          onTouchMove={(event) => event.preventDefault()}
        >
          <div className="absolute inset-0 bg-white/30 backdrop-blur-[2px]" />
          <div className="absolute inset-0 flex items-center justify-center px-6">
            <div className="pointer-events-none w-full max-w-lg rounded-3xl bg-white/95 px-6 py-5 text-center shadow-2xl ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-slate-800">{progressLabel}</div>
              <div className="mt-1 text-xs text-slate-500">{progressSubLabel}</div>
              {loadStage?.stage ? (
                <div className="mt-1 text-[0.6rem] uppercase tracking-[0.25em] text-slate-400">
                  Stage {loadStage.stage.replace(/-/g, " ")}
                </div>
              ) : null}
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-500 via-sky-600 to-violet-500 transition-all"
                  style={{ width: `${progressPercent ?? 5}%` }}
                />
              </div>
              <div className="mt-2 text-[0.7rem] text-slate-500">
                {progressPercent !== null
                  ? `${progressPercent}% • ${loadProgress?.triangles?.toLocaleString() ?? 0} / ${loadProgress?.totalTriangles?.toLocaleString() ?? 0} tri`
                  : "Building geometry…"}
              </div>
              <div className="mt-1 text-[0.65rem] text-slate-400">
                Elapsed {elapsedLabel}
                {rateLabel ? ` • ${rateLabel}` : ""}
                {lastUpdateLabel ? ` • Last update ${lastUpdateLabel} ago` : ""}
              </div>
            </div>
          </div>
        </div>
      )}
      <div className={`pointer-events-none absolute inset-0 transition-opacity duration-150 ${dragActive ? 'opacity-100' : 'opacity-0'}`}>
        <div className="absolute inset-0 bg-sky-300/10 backdrop-blur-[2px]" />
      </div>
      <div className={`relative z-20 ${pageHeightClass} w-full`}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".3mf"
          hidden
          onChange={handleFileInputChange}
        />

        {showScene && (
          <ViewerHud
            showScene={showScene}
            fps={fps}
            helpButtonRef={helpButtonRef}
            onBackToStart={clearScene}
          />
        )}


        {((!showScene) || dragActive) && (
          <ViewerHome
            showScene={showScene}
            dragActive={dragActive}
            backgroundClass={homeBackgroundClass}
            heroHeading={heroHeading}
            heroSubtext={heroSubtext}
            dropHint={dropHint}
            browseButtonClass={browseButtonClass}
            loadStatus={loadStatus}
            onBrowseClick={handleBrowseClick}
            sampleModels={sampleModels}
            sampleLoading={sampleLoading}
            sampleError={sampleError}
            onLoadSample={handleLoadSample}
            upcomingCards={upcomingCards}
            renderingRoadmap={renderingRoadmap}
            getStatusMeta={getStatusMeta}
            onOpenReleaseNotes={() => setOpenReleaseNotes(true)}
            appVersion={appVersion}
          />
        )}


        <ViewerScene
          showScene={showScene}
          initialCamPos={initialCamPos}
          initialTarget={initialTarget}
          controlsRef={controlsRef}
          cameraRef={cameraRef}
          rendererRef={rendererRef}
          setCanvasElement={setCanvasElement}
          contentRef={contentRef}
          groundSize={groundSize}
          groundY={groundY}
          gridDivisions={gridDivisions}
          treeItems={treeItems}
          onSelectFile={() => fileInputRef.current?.click()}
          sceneMetadata={sceneData?.metadata}
          onUpdateSpecifications={checkSpecifications}
        />

        {helpAvailable && helpCardOpen && (
          <div className="pointer-events-none fixed right-3 top-24 z-40 sm:top-28">
            <div
              ref={helpCardRef}
              className="pointer-events-auto w-64 rounded-2xl bg-white/95 p-4 text-sm text-slate-600 shadow-2xl ring-1 ring-slate-200"
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Viewer tips
                </p>
                <button
                  type="button"
                  aria-label="Close viewer tips"
                  className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  onClick={() => setHelpCardOpen(false)}
                >
                  <IconClose />
                </button>
              </div>
              <ul className="space-y-1.5">
                {helpItems.map((item, index) => (
                  <li key={index} className="flex items-start gap-2 text-xs text-slate-600">
                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <ViewerOverlays
          showDesktopBottomBar={showBottomBar && !isCoarsePointer}
          showTabletDock={showBottomBar && showTouchTabletFull}
          showTouchFab={showBottomBar && showTouchFab}
          controls={viewerControls}
        />

        <Modal
          open={diagnosticsNoticeOpen && !!diagnosticsNotice}
          title="Import issues detected"
          subtitle="Some diagnostics reported errors while reading this 3MF."
          onClose={() => setDiagnosticsNoticeOpen(false)}
          footer={
            <button
              onClick={() => setDiagnosticsNoticeOpen(false)}
              className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-slate-800"
            >
              Got it
            </button>
          }
        >
          {diagnosticsNotice ? (
            <div className="space-y-4 text-sm text-slate-600">
              <p>
                {`While importing ${diagnosticsNotice.fileName || "this model"}, lib3mf reported ${diagnosticsNotice.errors.toLocaleString()} error${diagnosticsNotice.errors === 1 ? "" : "s"
                  }.`}
              </p>
              <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-4">
                <div className="text-[0.75rem] font-semibold uppercase tracking-wide text-rose-600">
                  Errors detected
                </div>
                <div className="mt-1 text-2xl font-semibold text-rose-700">
                  {diagnosticsNotice.errors.toLocaleString()}
                </div>
                <p className="mt-2 text-[0.75rem] text-rose-600">
                  Portions of the scene or metadata may be incomplete or unreliable.
                </p>
              </div>
              {diagnosticsNotice.warnings > 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
                  <div className="text-[0.75rem] font-semibold uppercase tracking-wide text-amber-600">
                    Warnings detected
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-amber-700">
                    {diagnosticsNotice.warnings.toLocaleString()}
                  </div>
                  <p className="mt-2 text-[0.75rem] text-amber-700">
                    Review the diagnostics tab to see the most common warning groups.
                  </p>
                </div>
              ) : null}
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 text-[0.8rem] leading-relaxed">
                <p className="font-semibold text-slate-700">Next steps</p>
                <ul className="mt-2 space-y-1 text-slate-600">
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-300" />
                    <span>Open the Diagnostics tab to review grouped issues and affected resources.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-slate-300" />
                    <span>Consider validating the source 3MF in your authoring tool before re-exporting.</span>
                  </li>
                </ul>
              </div>
            </div>
          ) : null}
        </Modal>

        {/* Scene Preferences Modal */}
        <Modal
          open={openPrefs}
          title="Scene Preferences"
          subtitle="Adjust background, lighting, helpers. Changes apply immediately."
          onClose={() => setOpenPrefs(false)}
          footer={
            <button
              onClick={restorePrefs}
              className="rounded-md bg-slate-800 text-white px-3 py-1.5 text-sm hover:bg-slate-700"
            >
              Restore defaults
            </button>
          }
        >
          <ScenePreferences prefs={prefs} onChange={setPrefs} />
        </Modal>

        <Modal
          open={openReleaseNotes}
          title={`Release Notes – v${appVersion}`}
          subtitle={releaseNotesTimelineOpen ? "Full release history" : "What’s new in this build"}
          onClose={() => {
            setOpenReleaseNotes(false);
            setReleaseNotesTimelineOpen(false);
          }}
          size="lg"
        >
          <ReleaseNotesModal
            title={`Version v${appVersion}`}
            subtitle={releaseNotesTimelineOpen ? "All release entries" : "Highlights"}
            currentVersion={`v${appVersion}`}
            currentNotes={currentNotes}
            releaseNotes={releaseNotes}
            showTimeline={releaseNotesTimelineOpen}
            onToggleTimeline={() => setReleaseNotesTimelineOpen((prev) => !prev)}
          />
        </Modal>
      </div>
    </div>
  );
}

function ViewerBootstrap() {
  const { ensureLib3mf } = useThreeMFLoader();
  const runtimeReady = useViewerStore((state) => state.runtime.ready);
  const runtimeError = useViewerStore((state) => state.runtime.error);
  const setRuntimeReady = useViewerStore((state) => state.setRuntimeReady);
  const setRuntimeError = useViewerStore((state) => state.setRuntimeError);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        setRuntimeError(null);
        await ensureLib3mf();
        if (!cancelled) setRuntimeReady(true);
      } catch (err) {
        console.error("Failed to initialize 3MF runtime", err);
        if (!cancelled) setRuntimeError(err);
      }
    };

    start();

    return () => {
      cancelled = true;
    };
  }, [ensureLib3mf, setRuntimeError, setRuntimeReady]);

  if (runtimeError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50 px-4 text-center text-slate-600">
        <img src="/3mf_logo.png" alt="3MF" className="h-10 w-auto opacity-90" />
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-rose-600">Viewer failed to start</h1>
          <p className="text-sm text-slate-500">
            We couldn’t download the 3MF runtime. Please check your connection and try reloading the page.
          </p>
        </div>
        <button
          type="button"
          className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white shadow transition hover:bg-slate-800"
          onClick={() => window.location.reload()}
        >
          Reload page
        </button>
      </div>
    );
  }

  if (!runtimeReady) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-slate-50 px-4 text-center text-slate-600">
        <img src="/3mf_logo.png" alt="3MF" className="h-10 w-auto opacity-90" />
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-4 border-slate-200" />
          <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-slate-500 animate-spin" />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-xl font-semibold text-slate-700">Preparing viewer…</h1>
          <p className="text-sm text-slate-500">
            Downloading the 3MF runtime and assets. This usually takes just a moment.
          </p>
        </div>
      </div>
    );
  }

  return <ViewerApp />;
}

export default function App() {
  return (
    <ThreeMFLoaderProvider>
      <ViewerBootstrap />
    </ThreeMFLoaderProvider>
  );
}

export { ViewerApp };
