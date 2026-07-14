import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { SceneTree } from '../src/components/ui/SceneTree'

describe('SceneTree keyboard navigation', () => {
  it('exposes tree semantics and expands groups with the arrow keys', async () => {
    const user = userEvent.setup()
    render(
      <SceneTree
        open
        items={[
          {
            id: 'assembly',
            name: 'Assembly',
            type: 'group',
            children: [{ id: 'part', name: 'Part', type: 'mesh', children: [], meta: {} }],
            meta: {},
          },
        ]}
        metadata={{ counts: {} }}
        loadStatus="ready"
      />
    )

    const tree = screen.getByRole('tree', { name: '3MF scene objects' })
    const assembly = screen.getByRole('treeitem', { name: /Assembly/ })
    expect(tree).toBeInTheDocument()
    expect(assembly).toHaveAttribute('aria-expanded', 'false')

    assembly.focus()
    await user.keyboard('{ArrowRight}')
    expect(assembly).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('treeitem', { name: /Part/ })).toBeInTheDocument()
  })
})
