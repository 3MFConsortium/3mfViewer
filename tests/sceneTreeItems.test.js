import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useSceneTreeItems } from '../src/hooks/viewer/useSceneTreeItems'

describe('useSceneTreeItems component instances', () => {
  it('assigns independent visibility IDs and bounds to shared mesh instances', () => {
    const meshResource = {
      resourceId: 1,
      displayName: 'Box',
      vertexCount: 8,
      triangleCount: 12,
    }
    const componentResource = {
      resourceId: 2,
      displayName: 'Assembly',
      components: [0, 1, 2].map((index) => ({
        index,
        targetId: 1,
        hasTransform: index > 0,
        transform4x3: null,
      })),
    }
    const instances = [0, 1, 2].map((index) => ({
      instanceId: index + 1,
      visibilityId: `instance:item-0-${index}`,
      bounds: {
        min: { x: index * 10, y: 0, z: 0 },
        max: { x: index * 10 + 10, y: 20, z: 30 },
        size: { x: 10, y: 20, z: 30 },
      },
    }))
    const sceneData = {
      meshResources: [meshResource],
      componentResources: [componentResource],
      items: [{ index: 0, resourceId: 2 }],
      instances,
    }

    const { result } = renderHook(() => useSceneTreeItems(sceneData, null))
    const children = result.current[0].children

    expect(children).toHaveLength(3)
    expect(children.map((child) => child.visibilityId)).toEqual([
      'instance:item-0-0',
      'instance:item-0-1',
      'instance:item-0-2',
    ])
    expect(children.every((child) => child.meta.bounds.size.z === 30)).toBe(true)
  })
})
