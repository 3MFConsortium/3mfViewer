#!/usr/bin/env node

import fs from "fs";
import path from "path";
import process from "process";

import lib3mf from "@3mfconsortium/lib3mf";

import { loadThreeMFModel } from "../src/lib/lib3mfEngine.js";

const [,, inputPath] = process.argv;

if (!inputPath) {
  console.error("Usage: node scripts/query-3mf.mjs <path_to_3mf>");
  process.exit(1);
}

const resolvedPath = path.resolve(process.cwd(), inputPath);
if (!fs.existsSync(resolvedPath)) {
  console.error(`File not found: ${resolvedPath}`);
  process.exit(1);
}

(async () => {
  const buffer = fs.readFileSync(resolvedPath);
  const lib = await lib3mf();

  const parsed = await loadThreeMFModel(lib, buffer, path.basename(resolvedPath));

  const summary = {
    file: resolvedPath,
    lib3mfVersion: parsed.lib3mfVersion,
    unit: parsed.unit,
    counts: parsed.counts,
    modelUUID: parsed.modelUUID,
    baseMaterialGroups: parsed.baseMaterialGroups,
    colorGroups: parsed.colorGroups,
  };

  const diagnostics = parsed.diagnostics;

  const meshes = parsed.meshResources.map((resource) => ({
    resourceId: resource.resourceId,
    uniqueResourceId: resource.uniqueResourceId,
    name: resource.displayName,
    uuid: resource.uuid,
    vertexCount: resource.vertexCount,
    triangleCount: resource.triangleCount,
    isBeamLattice: resource.isBeamLattice,
    beamCount: resource.beamLattice?.beamCount ?? 0,
    ballCount: resource.beamLattice?.ballCount ?? 0,
    beamRadiusRange: resource.beamLattice?.beams?.length
      ? resource.beamLattice.beams.reduce(
          (range, beam) => ({
            min: Math.min(range.min, ...beam.radii),
            max: Math.max(range.max, ...beam.radii),
          }),
          { min: Infinity, max: -Infinity }
        )
      : null,
    usesVertexColors: resource.usesVertexColors,
    materialColorStats: resource.materialColorStats,
  }));

  const components = parsed.componentResources.map((resource) => ({
    resourceId: resource.resourceId,
    uniqueResourceId: resource.uniqueResourceId,
    name: resource.displayName,
    uuid: resource.uuid,
    componentCount: resource.components?.length ?? 0,
  }));

  const items = parsed.items;
  const instances = parsed.geometry?.instances ?? [];

  console.log(JSON.stringify({ summary, diagnostics, meshes, components, instances, items }, null, 2));
})();
