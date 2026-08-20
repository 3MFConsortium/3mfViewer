import { describe, it, expect } from 'vitest'
import { performance } from 'perf_hooks'
import lib3mf from '@3mfconsortium/lib3mf'
import { Lib3mfEngine } from '../src/lib/lib3mfEngine'
import fs from 'fs'
import path from 'path'

describe('Lib3mfEngine Integration', () => {
    it('should load and parse cube.3mf correctly', async () => {
        const lib = await lib3mf()
        const engine = new Lib3mfEngine(lib)

        const filePath = path.resolve(__dirname, '../public/data/cube.3mf')
        const buffer = fs.readFileSync(filePath)

        const result = await engine.loadFromBuffer(new Uint8Array(buffer), 'cube.3mf')

        expect(result).toBeDefined()
        expect(result.counts.meshes).toBe(3)
        expect(result.items.length).toBe(1)
        expect(result.meshResources.length).toBe(1)

        const mesh = result.meshResources[0]
        expect(mesh.vertexCount).toBe(8)
        expect(mesh.triangleCount).toBe(12)
        expect(mesh.positions.length).toBe(8 * 3)
        expect(mesh.indices.length).toBe(12 * 3)
        expect(Number.isFinite(mesh.modelResourceId)).toBe(true)
        expect(mesh.internalResourceId).toBe(mesh.resourceId)

        expect(result.geometry.instances).toHaveLength(3)
        expect(result.geometry.instances.every((instance) =>
            instance.modelResourceId === mesh.modelResourceId
        )).toBe(true)
        expect(new Set(result.geometry.instances.map((instance) => instance.visibilityId)).size).toBe(3)
        expect(new Set(Array.from(result.geometry.instanceIds))).toEqual(new Set([1, 2, 3]))
        expect(result.geometry.instances.map((instance) => instance.bounds.size)).toEqual([
            { x: 10, y: 20, z: 30 },
            { x: 10, y: 20, z: 30 },
            { x: 10, y: 20, z: 30 },
        ])
    })

    it('preserves independent instances and transformed bounds in PartsForBoundingBox.3mf', async () => {
        const lib = await lib3mf()
        const engine = new Lib3mfEngine(lib)
        const filePath = path.resolve(__dirname, '../public/data/PartsForBoundingBox.3mf')
        const result = await engine.loadFromBuffer(
            new Uint8Array(fs.readFileSync(filePath)),
            'PartsForBoundingBox.3mf'
        )

        expect(result.geometry.instances).toHaveLength(3)
        expect(result.geometry.instances.map((instance) => instance.resourceId)).toEqual([2, 3, 2])
        expect(new Set(result.geometry.instances.map((instance) => instance.visibilityId)).size).toBe(3)
        expect(result.geometry.instances.every((instance) =>
            Object.values(instance.bounds.size).every((value) => Number.isFinite(value) && value > 0)
        )).toBe(true)
    })

    it('reads beam lattices that coexist with a core mesh without flattening their radii', async () => {
        const lib = await lib3mf()
        const engine = new Lib3mfEngine(lib)
        const filePath = path.resolve(__dirname, './fixtures/BeamLatticeBox.3mf')
        const result = await engine.loadFromBuffer(
            new Uint8Array(fs.readFileSync(filePath)),
            'BeamLatticeBox.3mf'
        )

        const beamResource = result.meshResources.find((resource) => resource.isBeamLattice)
        expect(beamResource?.triangleCount).toBe(12)
        expect(beamResource?.beamLattice?.beamCount).toBe(12)
        expect(result.geometry.vertexCount).toBe(36)
        expect(result.geometry.beamLines.positions).toHaveLength(12 * 6)
        expect(result.geometry.beamLines.radii).toHaveLength(12 * 2)
        expect(Array.from(result.geometry.beamLines.radii.slice(2, 4))).toEqual([
            expect.closeTo(3.1),
            expect.closeTo(3.2),
        ])
        expect(result.geometry.instances[0].bounds.min.x).toBeLessThan(0)
    })

    it('loads the public brake pedal with its mesh and spherical-cap lattice', async () => {
        const lib = await lib3mf()
        const engine = new Lib3mfEngine(lib)
        const filePath = path.resolve(__dirname, '../public/data/BrakePedal.3mf')
        const result = await engine.loadFromBuffer(
            new Uint8Array(fs.readFileSync(filePath)),
            'BrakePedal.3mf'
        )

        const beamResource = result.meshResources.find((resource) => resource.isBeamLattice)
        expect(beamResource?.beamLattice?.beamCount).toBe(2048)
        expect(beamResource?.beamLattice?.balls).toHaveLength(0)
        expect(beamResource?.beamLattice?.beams[0].capModes).toEqual(['sphere', 'sphere'])
        expect(result.geometry.vertexCount / 3).toBe(1884)
        expect(result.geometry.beamLines.renderMode).toBe('solid')
    })

    it('loads the dense octet stress model without expanding beams into triangles', async () => {
        const lib = await lib3mf()
        const engine = new Lib3mfEngine(lib)
        const filePath = path.resolve(__dirname, '../public/data/OctetLattice.3mf')
        const result = await engine.loadFromBuffer(
            new Uint8Array(fs.readFileSync(filePath)),
            'OctetLattice.3mf'
        )

        expect(result.meshResources.filter((resource) => resource.isBeamLattice)).toHaveLength(14)
        expect(result.geometry.instances).toHaveLength(14)
        expect(result.geometry.vertexCount).toBe(0)
        expect(result.geometry.beamLines.positions).toHaveLength(132440 * 6)
        expect(result.geometry.beamLines.capModes.every((mode) => mode === 1)).toBe(true)
    })

    it('should load and parse colorcube.3mf with vertex colors', async () => {
        const lib = await lib3mf()
        const engine = new Lib3mfEngine(lib)

        const filePath = path.resolve(__dirname, '../public/data/colorcube.3mf')
        const buffer = fs.readFileSync(filePath)

        const result = await engine.loadFromBuffer(new Uint8Array(buffer), 'colorcube.3mf')

        expect(result).toBeDefined()
        expect(result.meshResources.length).toBe(1)
        expect(result.meshResources[0].usesVertexColors).toBe(true)
        expect(result.meshResources[0].vertexColors).toBeDefined()
        // Check if first triangle has colors (not all zero)
        expect(result.meshResources[0].vertexColors[0] + result.meshResources[0].vertexColors[1] + result.meshResources[0].vertexColors[2]).toBeGreaterThan(0)
    })

    const timingEnabled = process.env.LIB3MF_TIMING === '1'
    const timingIt = timingEnabled ? it : it.skip

    timingIt('times Wheel.3mf parse with lib3mfEngine', async () => {
        const filePath = path.resolve(__dirname, '../public/data/Wheel.3mf')
        if (!fs.existsSync(filePath)) {
            console.warn(`Wheel.3mf not found at ${filePath}; skipping timing test.`)
            return
        }

        const libStart = performance.now()
        const lib = await lib3mf()
        const libReadyMs = performance.now() - libStart

        const engine = new Lib3mfEngine(lib)
        const buffer = fs.readFileSync(filePath)

        const parseStart = performance.now()
        const result = await engine.loadFromBuffer(new Uint8Array(buffer), 'Wheel.3mf')
        const parseMs = performance.now() - parseStart

        console.log(
            JSON.stringify(
                {
                    file: filePath,
                    libReadyMs: Math.round(libReadyMs),
                    parseMs: Math.round(parseMs),
                    counts: result?.counts,
                    meshes: result?.meshResources?.length ?? 0
                },
                null,
                2
            )
        )
    })
})
/* global __dirname, process */
