import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { Modal } from '../src/components/ui/Modal'

describe('Modal', () => {
  it('labels the dialog, traps focus, closes on Escape, and restores focus', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()

    const { unmount } = render(
      <Modal open title="Preferences" subtitle="Viewer settings" onClose={onClose}>
        <button type="button">First action</button>
      </Modal>
    )

    const dialog = screen.getByRole('dialog', { name: 'Preferences' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus()
    expect(document.body.style.overflow).toBe('hidden')

    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledOnce()
    unmount()
    expect(opener).toHaveFocus()
    expect(document.body.style.overflow).toBe('')
    opener.remove()
  })
})
