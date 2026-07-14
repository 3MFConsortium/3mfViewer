import { describe, it, expect } from 'vitest'
import lib3mf from '@3mfconsortium/lib3mf'
import fs from 'fs'
import path from 'path'

import { loadThreeMFModel } from '../src/lib/lib3mfEngine'

const sliceSamples = [
  { fileName: 'P_SXX_0101_03.3mf', minSliceCount: 1000 },
  { fileName: 'box_sliced.3mf', minSliceCount: 300 },
  { fileName: 'sphere_sliced.3mf', minSliceCount: 200 },
  { fileName: 'torus_sliced.3mf', minSliceCount: 40 },
  { fileName: 'cube_gears_sliced.3mf', minSliceCount: 40 },
]

describe('Slice stack integration', () => {
  it.each(sliceSamples)('reads indexed vertices from $fileName without bulk slice bindings', async ({ fileName, minSliceCount }) => {
    const filePath = path.resolve(__dirname, `../public/data/slice/${fileName}`)
    const buffer = fs.readFileSync(filePath)
    const lib = await lib3mf()

    const parsed = await loadThreeMFModel(lib, buffer, fileName)

    expect(parsed).toBeDefined()
    expect(Array.isArray(parsed.sliceStacks)).toBe(true)
    expect(parsed.sliceStacks.length).toBeGreaterThan(0)

    const primaryStack = parsed.sliceStacks.find((stack) => (stack.sliceCount ?? 0) > 0)
    expect(primaryStack).toBeDefined()
    expect(primaryStack.sliceCount).toBeGreaterThan(minSliceCount)

    const firstSlice = primaryStack.slices[0]
    expect(firstSlice).toBeDefined()
    expect(firstSlice.vertexCount).toBeGreaterThan(0)
    expect(firstSlice.polygonCount).toBeGreaterThan(0)
    expect(Array.isArray(firstSlice.vertices)).toBe(true)
    expect(firstSlice.vertices).toHaveLength(firstSlice.vertexCount)
    expect(firstSlice.vertices.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))).toBe(true)
    expect(Array.isArray(firstSlice.polygonIndexCounts)).toBe(true)
    expect(firstSlice.polygonIndexCounts).toHaveLength(firstSlice.polygonCount)
    expect(firstSlice.polygons).toHaveLength(firstSlice.polygonCount)
    expect(firstSlice.polygons.every(({ indices }) => indices.length >= 3)).toBe(true)
  })
})

/* global __dirname */
