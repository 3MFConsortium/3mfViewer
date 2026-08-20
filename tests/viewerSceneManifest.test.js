import { describe, expect, it } from "vitest";
import {
  buildSceneManifest,
  resolveSceneTargets,
} from "../src/lib/viewerSceneManifest.js";

const treeItems = [{
  id: "assembly",
  name: "Assembly",
  type: "group",
  children: [{
    id: "mesh-7-item-0",
    visibilityId: "instance:item-0",
    name: "Wheel",
    type: "mesh",
    children: [],
    meta: {
      internalResourceId: 7,
      modelResourceId: 42,
      instanceId: 3,
      bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 2, y: 4, z: 6 } },
    },
  }],
}];

describe("viewer scene manifest", () => {
  it("resolves canonical model resource IDs without exposing geometry", () => {
    expect(resolveSceneTargets(treeItems, { modelResourceId: 42 })[0].visibilityId)
      .toBe("instance:item-0");
    const manifest = buildSceneManifest({
      treeItems,
      loadedName: "Wheel.3mf",
      hiddenMeshIds: ["instance:item-0"],
      selectedNodeId: "mesh-7-item-0",
      sceneData: {
        meshResources: [{
          resourceId: 7,
          internalResourceId: 7,
          modelResourceId: 42,
          displayName: "Wheel",
          positions: new Float32Array(1000),
          triangleCount: 12,
        }],
        metadata: { modelUUID: "model-uuid", counts: { meshes: 1 } },
      },
    });
    expect(manifest.resources[0]).toMatchObject({
      modelResourceId: 42,
      internalResourceId: 7,
      triangleCount: 12,
    });
    expect(manifest.resources[0]).not.toHaveProperty("positions");
    expect(manifest.instances[0]).toMatchObject({ visible: false, selected: true });
  });
});
