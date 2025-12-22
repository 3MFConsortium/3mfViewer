import lib3mf from "@tensorgrad/lib3mf";
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

  parsed?.meshResources?.forEach((resource) => {
    pushBuffer(resource.positions);
    pushBuffer(resource.indices);
    pushBuffer(resource.vertexColors);
  });

  parsed?.texture2Ds?.forEach((entry) => {
    pushBuffer(entry.buffer);
  });

  return transfer;
};

self.onmessage = async (event) => {
  const { id, arrayBuffer, fileName, options } = event.data || {};
  try {
    const lib = await ensureLib3mf();
    const parsed = await loadThreeMFModel(lib, arrayBuffer, fileName, options);
    const transfer = collectTransferables(parsed);
    self.postMessage({ id, ok: true, parsed }, transfer);
  } catch (error) {
    const message = error?.message || "Failed to parse 3MF in worker.";
    self.postMessage({ id, ok: false, error: message });
  }
};
