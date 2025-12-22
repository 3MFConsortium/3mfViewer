import { describe, it, expect } from 'vitest'
import lib3mf from '@tensorgrad/lib3mf'
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
        expect(result.counts.meshes).toBe(1)
        expect(result.items.length).toBe(1)
        expect(result.meshResources.length).toBe(1)

        const mesh = result.meshResources[0]
        expect(mesh.vertexCount).toBe(8)
        expect(mesh.triangleCount).toBe(12)
        expect(mesh.positions.length).toBe(8 * 3)
        expect(mesh.indices.length).toBe(12 * 3)
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
})
