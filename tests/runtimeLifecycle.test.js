import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'

import { calculateFitDistance } from '../src/hooks/viewer/useCameraControls'
import { createBeamLatticeGroup, createInstancedBeams } from '../src/lib/beamLatticeGeometry'
import { disposeThreeObject } from '../src/lib/disposeThreeObject'
import { createLoadGate } from '../src/lib/loadGate'
import worker from '../src/worker'
import { DEFAULT_PREFS, sanitizePrefs } from '../src/stores/viewerStore'

describe('calculateFitDistance', () => {
  it('fits a bounding sphere against the limiting viewport field of view', () => {
    const size = new THREE.Vector3(10, 20, 30)
    const portrait = calculateFitDistance(size, 50, 0.5)
    const landscape = calculateFitDistance(size, 50, 2)

    expect(portrait).toBeGreaterThan(landscape)
    expect(landscape).toBeGreaterThan(size.length() / 2)
  })
})

describe('disposeThreeObject', () => {
  it('disposes shared geometry, material, and textures exactly once', () => {
    const scene = new THREE.Group()
    const geometry = new THREE.BufferGeometry()
    const texture = new THREE.Texture()
    const material = new THREE.MeshBasicMaterial({ map: texture })
    const geometryDispose = vi.spyOn(geometry, 'dispose')
    const materialDispose = vi.spyOn(material, 'dispose')
    const textureDispose = vi.spyOn(texture, 'dispose')
    scene.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material))

    disposeThreeObject(scene)

    expect(geometryDispose).toHaveBeenCalledOnce()
    expect(materialDispose).toHaveBeenCalledOnce()
    expect(textureDispose).toHaveBeenCalledOnce()
  })
})

describe('createLoadGate', () => {
  it('invalidates earlier requests and explicit cancellation', () => {
    const gate = createLoadGate()
    const first = gate.begin()
    const second = gate.begin()

    expect(gate.isCurrent(first)).toBe(false)
    expect(gate.isCurrent(second)).toBe(true)
    gate.cancel()
    expect(gate.isCurrent(second)).toBe(false)
  })
})

describe('beam lattice rendering', () => {
  const beamData = {
    positions: new Float32Array([0, 0, 0, 0, 10, 0, 0, 10, 0, 10, 10, 0]),
    radii: new Float32Array([1, 2, 2, 0.5]),
    resourceIds: new Float32Array([7, 7]),
    instanceIds: new Float32Array([3, 3]),
    ballPositions: new Float32Array([0, 10, 0]),
    ballRadii: new Float32Array([2.5]),
    ballResourceIds: new Float32Array([7]),
    ballInstanceIds: new Float32Array([3]),
  }

  it('uses one tapered GPU instance per beam', () => {
    const beams = createInstancedBeams(beamData, [0, 1])
    expect(beams.count).toBe(2)
    expect(Array.from(beams.geometry.getAttribute('beamRadiusStart').array)).toEqual([0.5, 1])
    expect(Array.from(beams.geometry.getAttribute('beamRadiusEnd').array)).toEqual([1, 0.25])
  })

  it('groups solid beams and balls under the source instance visibility id', () => {
    const group = createBeamLatticeGroup(beamData, [{ instanceId: 3, visibilityId: 'instance:item-0' }])
    expect(group.children).toHaveLength(2)
    expect(group.children.every((child) => child.isInstancedMesh)).toBe(true)
    expect(group.children.every((child) => child.userData.visibilityId === 'instance:item-0')).toBe(true)
  })

  it('deduplicates spherical caps shared by connected beams', () => {
    const cappedData = {
      ...beamData,
      capModes: new Uint8Array([1, 1, 1, 1]),
    }
    const group = createBeamLatticeGroup(cappedData, [{ instanceId: 3 }])
    const nodeMesh = group.children.find((child) => child.name === 'Beam lattice balls')

    expect(nodeMesh.count).toBe(3)
  })

  it('uses an open low-sided tube template for dense spherical-cap lattices', () => {
    const denseData = {
      positions: new Float32Array(50001 * 6),
      radii: new Float32Array([1, 1]),
      capModes: new Uint8Array([1, 1]),
    }
    denseData.positions.set([0, 0, 0, 0, 10, 0])
    const beams = createInstancedBeams(denseData, [0])

    expect(beams.geometry.getAttribute('position').count).toBeLessThan(20)
  })
})

describe('Cloudflare response headers', () => {
  it('adds baseline security headers while allowing iframe embedding', async () => {
    const response = await worker.fetch(
      new Request('https://3mfviewer.com/'),
      { ASSETS: { fetch: async () => new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } }) } }
    )

    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(response.headers.get('Content-Security-Policy')).toContain('frame-ancestors *')
  })
})

describe('sanitizePrefs', () => {
  it('clamps numeric values and rejects malformed persisted preferences', () => {
    const prefs = sanitizePrefs({
      ambient: 99,
      rimIntensity: '0.4',
      background: 'not-a-color',
      ground: 'yes',
      beamLatticeMode: 'invalid',
      sliceIndex: -8,
    })

    expect(prefs.ambient).toBe(2)
    expect(prefs.rimIntensity).toBe(0.4)
    expect(prefs.background).toBe(DEFAULT_PREFS.background)
    expect(prefs.ground).toBe(DEFAULT_PREFS.ground)
    expect(prefs.beamLatticeMode).toBe(DEFAULT_PREFS.beamLatticeMode)
    expect(prefs.sliceIndex).toBe(-1)
  })
})
