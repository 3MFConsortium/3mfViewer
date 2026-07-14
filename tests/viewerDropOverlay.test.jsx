import React, { useState } from 'react'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ViewerDropOverlay } from '../src/components/viewer/ViewerDropOverlay'
import { useDragDrop } from '../src/hooks/viewer/useDragDrop'

const dispatchDrag = (type, dataTransfer) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer })
  act(() => window.dispatchEvent(event))
}

function DragProbe({ onFile }) {
  const [active, setActive] = useState(false)
  useDragDrop(onFile, setActive)
  return <span>{active ? 'active' : 'inactive'}</span>
}

describe('ViewerDropOverlay', () => {
  it('stays viewport-centered and transitions without remounting its content', () => {
    const { rerender } = render(<ViewerDropOverlay active={false} />)
    const status = screen.getByRole('status', { hidden: true })
    const label = screen.getByText('Drop your 3MF file')

    expect(status).toHaveClass('fixed', 'inset-0', 'invisible')
    rerender(<ViewerDropOverlay active />)
    expect(screen.getByText('Drop your 3MF file')).toBe(label)
    expect(status).toHaveClass('visible', 'opacity-100')
  })
})

describe('useDragDrop', () => {
  it('activates only for file drags and loads the dropped file', () => {
    const onFile = vi.fn()
    render(<DragProbe onFile={onFile} />)

    dispatchDrag('dragenter', { types: ['text/plain'] })
    expect(screen.getByText('inactive')).toBeInTheDocument()

    dispatchDrag('dragenter', { types: ['Files'] })
    expect(screen.getByText('active')).toBeInTheDocument()

    const file = new File(['3mf'], 'model.3mf')
    dispatchDrag('drop', { types: ['Files'], files: [file] })
    expect(screen.getByText('inactive')).toBeInTheDocument()
    expect(onFile).toHaveBeenCalledWith(file)
  })
})
