import { useEffect } from 'react'
import type { RefObject } from 'react'

const FOCUSABLE =
  'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])'

// Traps keyboard focus inside a container element.
// Also moves focus to the first focusable child on mount.
export function useFocusTrap(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    // Focus the first interactive element when the container mounts.
    const first = el.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()

    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key !== 'Tab' || !el) return
      const focusable = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusable.length === 0) return
      const firstEl = focusable[0]
      const lastEl = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }

    el.addEventListener('keydown', handleKeyDown)
    return () => el.removeEventListener('keydown', handleKeyDown)
  }, [ref])
}
