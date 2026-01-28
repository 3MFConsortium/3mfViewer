import fs from "node:fs";
import lib3mf from "@3mfconsortium/lib3mf";

const filePath = process.argv[2];
if (!filePath) {
  console.error("Usage: node scripts/test-slices.mjs /path/to/file.3mf");
  process.exit(1);
}

const buffer = fs.readFileSync(filePath);
const lib = await lib3mf();
const wrapper = new lib.CWrapper();
const model = wrapper.CreateModel();
const reader = model.QueryReader("3mf");

const tempPath = `/slice_${Date.now().toString(36)}.3mf`;
lib.FS.writeFile(tempPath, new Uint8Array(buffer));

const safeDelete = (value) => {
  try {
    value?.delete?.();
  } catch {
    // ignore
  }
};

const toNumber = (value, fallback = 0) => {
  if (typeof value === "bigint") return Number(value);
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

try {
  reader.ReadFromFile(tempPath);

  const meshIterator = model.GetMeshObjects?.();
  if (meshIterator) {
    console.log("Meshes with slice info:");
    while (meshIterator.MoveNext?.()) {
      const mesh = meshIterator.GetCurrentMeshObject?.();
      if (!mesh) continue;
      try {
        const id = mesh.GetResourceID?.();
        const hasSlices = mesh.HasSlices?.(false) ? true : false;
        const resolution = mesh.GetSlicesMeshResolution?.();
        const sliceStack = mesh.GetSliceStack?.();
        let sliceStackId = null;
        let sliceCount = null;
        if (sliceStack) {
          sliceStackId = sliceStack.GetResourceID?.();
          sliceCount = sliceStack.GetSliceCount?.();
        }
        console.log(`- mesh ${id ?? "?"} hasSlices=${hasSlices} resolution=${resolution ?? "?"} stack=${sliceStackId ?? "?"} slices=${sliceCount ?? "?"}`);
        safeDelete(sliceStack);
      } finally {
        safeDelete(mesh);
      }
    }
    safeDelete(meshIterator);
  }

  const iterator = model.GetSliceStacks?.();
  if (!iterator) {
    console.log("No slice stacks found.");
    process.exit(0);
  }

  let stackIndex = 0;
  while (iterator.MoveNext?.()) {
    const stack = iterator.GetCurrentSliceStack?.();
    if (!stack) continue;
    try {
      const resourceId = stack.GetResourceID?.();
      const bottomZ = stack.GetBottomZ?.();
      const sliceCount = toNumber(stack.GetSliceCount?.() ?? 0, 0);
      console.log(`\nSliceStack #${stackIndex} id=${resourceId ?? "?"} bottomZ=${bottomZ ?? "?"} slices=${sliceCount}`);

      for (let i = 0; i < sliceCount; i += 1) {
        const slice = stack.GetSlice?.(i);
        if (!slice) continue;
        try {
          const zTop = slice.GetZTop?.();
        const vertexCount = toNumber(slice.GetVertexCount?.() ?? 0, 0);
        const polygonCount = toNumber(slice.GetPolygonCount?.() ?? 0, 0);
        console.log(`  Slice ${i}: zTop=${zTop ?? "?"} vertices=${vertexCount} polygons=${polygonCount}`);

        const previewCount = Math.min(vertexCount, 3);
          for (let v = 0; v < previewCount; v += 1) {
            const vertex = slice.GetVertex?.(v);
            if (!vertex) continue;
            try {
              const x = vertex.get_Coordinates0?.();
              const y = vertex.get_Coordinates1?.();
              console.log(`    v${v}: ${x ?? "?"}, ${y ?? "?"}`);
            } finally {
              safeDelete(vertex);
            }
          }

          for (let p = 0; p < polygonCount; p += 1) {
          const indexCount = toNumber(slice.GetPolygonIndexCount?.(p) ?? 0, 0);
          console.log(`    polygon ${p}: indices=${indexCount}`);
          }
        } finally {
          safeDelete(slice);
        }
      }
      stackIndex += 1;
    } finally {
      safeDelete(stack);
    }
  }
  safeDelete(iterator);
} finally {
  try {
    lib.FS.unlink?.(tempPath);
  } catch {
    // ignore
  }
  safeDelete(reader);
  safeDelete(model);
  safeDelete(wrapper);
}
