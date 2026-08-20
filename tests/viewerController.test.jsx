import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useViewerController } from "../src/hooks/viewer/useViewerController.js";

const createProps = () => ({
  treeItems: [{
    id: "mesh-node",
    visibilityId: "instance:item-0",
    name: "Wheel",
    type: "mesh",
    children: [],
    meta: { internalResourceId: 7, modelResourceId: 42, instanceId: 1 },
  }],
  sceneData: { meshResources: [], componentResources: [], metadata: {} },
  sceneBounds: null,
  loadedName: "Wheel.3mf",
  loadStatus: "ready",
  renderReady: true,
  prefs: { wireframe: false },
  hiddenMeshIds: [],
  selectedNodeId: null,
  selectedNodeInfo: null,
  loadFromArrayBuffer: vi.fn().mockResolvedValue(undefined),
  decodeBase64ToArrayBuffer: vi.fn(),
  clearScene: vi.fn(),
  setSelectedNode: vi.fn(),
  setMeshVisibility: vi.fn(),
  isolateMeshIds: vi.fn(),
  resetVisibility: vi.fn(),
  setPrefs: vi.fn(),
  handleFit: vi.fn(() => true),
  handleResetView: vi.fn(),
  getCameraState: vi.fn(() => ({ position: [1, 1, 1], target: [0, 0, 0] })),
  setCameraState: vi.fn(() => true),
  setPresetView: vi.fn(() => true),
  capturePng: vi.fn().mockResolvedValue({ blob: new Blob(["png"]), width: 1, height: 1 }),
});

describe("viewer controller", () => {
  it("selects and changes visibility using canonical resource IDs", async () => {
    const props = createProps();
    const { result } = renderHook(() => useViewerController(props));
    let selected;
    await act(async () => {
      selected = await result.current.execute("scene.select", {
        target: { modelResourceId: 42 },
      });
      await result.current.execute("scene.setVisibility", {
        target: { modelResourceId: 42 },
        visible: false,
      });
    });
    expect(selected.selected).toMatchObject({ id: "mesh-node", visibilityId: "instance:item-0" });
    expect(props.setSelectedNode).toHaveBeenCalledWith(expect.objectContaining({ id: "mesh-node" }));
    expect(props.setMeshVisibility).toHaveBeenCalledWith("instance:item-0", false);
  });

  it("provides camera, rendering, capture, and capability commands", async () => {
    const props = createProps();
    const { result } = renderHook(() => useViewerController(props));
    await expect(result.current.execute("viewer.getCapabilities"))
      .resolves.toMatchObject({ protocolVersion: 1 });
    await expect(result.current.execute("camera.setPreset", { preset: "top" }))
      .resolves.toMatchObject({ target: [0, 0, 0] });
    await result.current.execute("render.setOptions", { options: { wireframe: true, unsafe: true } });
    expect(props.setPrefs).toHaveBeenCalled();
    await expect(result.current.execute("capture.png"))
      .resolves.toMatchObject({ width: 1, height: 1 });
  });
});
