import lib3mf from "@3mfconsortium/lib3mf";
import { loadThreeMFModel } from "../lib/lib3mfEngine.js";

let libInstance = null;

const ensureLib3mf = async () => {
  if (!libInstance) {
    libInstance = lib3mf();
  }
  return libInstance;
};

const collectTransferables = (parsed) => {
  const transfer = [];

  const pushBuffer = (value) => {
    if (!value) return;
    if (ArrayBuffer.isView(value)) {
      transfer.push(value.buffer);
    } else if (value instanceof ArrayBuffer) {
      transfer.push(value);
    } else if (Array.isArray(value)) {
      value.forEach(pushBuffer);
    }
  };

  if (parsed?.geometry) {
    pushBuffer(parsed.geometry.positions);
    pushBuffer(parsed.geometry.colors);
    pushBuffer(parsed.geometry.uvs);
    pushBuffer(parsed.geometry.resourceIds);
    if (parsed.geometry.beamLines) {
      pushBuffer(parsed.geometry.beamLines.positions);
      pushBuffer(parsed.geometry.beamLines.resourceIds);
      pushBuffer(parsed.geometry.beamLines.radii);
    }
  } else {
    // Legacy fallback (shouldn't be needed if engine updated, but safe to keep or remove specific resource buffers if we don't want them anymore)
    parsed?.meshResources?.forEach((resource) => {
      pushBuffer(resource.positions);
      pushBuffer(resource.indices);
      pushBuffer(resource.vertexColors);
      pushBuffer(resource.textureCoordinates);
    });
  }

  parsed?.texture2Ds?.forEach((entry) => {
    pushBuffer(entry.buffer);
  });

  return transfer;
};

self.onmessage = async (event) => {
  const { id, arrayBuffer, fileName, options } = event.data || {};
  try {
    const totalStart = performance.now();
    const libStart = performance.now();
    const lib = await ensureLib3mf();
    const libInitMs = performance.now() - libStart;
    const parseStart = performance.now();
    const parsed = await loadThreeMFModel(lib, arrayBuffer, fileName, options);
    const parseMs = performance.now() - parseStart;
    const totalMs = performance.now() - totalStart;
    const transfer = collectTransferables(parsed);
    self.postMessage(
      { id, ok: true, parsed, timing: { libInitMs, parseMs, totalMs } },
      transfer
    );
  } catch (error) {
    const message = error?.message || "Failed to parse 3MF in worker.";
    self.postMessage({ id, ok: false, error: message });
  }
};
