import { describe, expect, it } from 'vitest'
import * as THREE from 'three'

import {
  buildSliceContourPositions,
  groupSlicePolygonLoops,
  setSliceSourceHidden,
} from '../src/hooks/viewer/useSliceView'

const square = (min, max) => [
  { x: min, y: min },
  { x: max, y: min },
  { x: max, y: max },
  { x: min, y: max },
]

describe('groupSlicePolygonLoops', () => {
  it('attaches a contained contour as a hole', () => {
    const groups = groupSlicePolygonLoops([square(0, 10), square(3, 7)])

    expect(groups).toHaveLength(1)
    expect(groups[0].outer).toEqual(square(0, 10))
    expect(groups[0].holes).toEqual([square(3, 7)])
  })

  it('keeps disjoint contours as separate solids', () => {
    const groups = groupSlicePolygonLoops([square(0, 2), square(4, 6)])

    expect(groups).toHaveLength(2)
    expect(groups.every(({ holes }) => holes.length === 0)).toBe(true)
  })
})

describe('buildSliceContourPositions', () => {
  it('batches every stack and slice into line segments', () => {
    const loop = square(0, 2)
    const makeSlice = (zTop) => ({
      zTop,
      vertices: loop,
      polygons: [{ indices: [0, 1, 2, 3] }],
    })
    const source = {
      center: { x: 1, y: 1, z: 1 },
      sliceStacks: [
        { slices: [makeSlice(0), makeSlice(1)] },
        { slices: [makeSlice(2)] },
      ],
    }

    const positions = buildSliceContourPositions(source)

    expect(positions).toBeInstanceOf(Float32Array)
    expect(positions).toHaveLength(3 * 4 * 2 * 3)
    expect(Array.from(positions.slice(0, 6))).toEqual([-1, -1, -1, 1, -1, -1])
  })
})

describe('setSliceSourceHidden', () => {
  it('hides source meshes with their helpers and restores prior visibility', () => {
    const scene = new THREE.Group()
    const visibleMesh = new THREE.Mesh()
    const alreadyHiddenMesh = new THREE.Mesh()
    alreadyHiddenMesh.visible = false
    visibleMesh.add(new THREE.LineSegments())
    scene.add(visibleMesh, alreadyHiddenMesh)

    setSliceSourceHidden(scene, true)
    expect(visibleMesh.visible).toBe(false)
    expect(alreadyHiddenMesh.visible).toBe(false)

    setSliceSourceHidden(scene, false)
    expect(visibleMesh.visible).toBe(true)
    expect(alreadyHiddenMesh.visible).toBe(false)
  })
})
