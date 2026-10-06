import type { Direction } from '../game/types.ts'

// One arrow shape drawn pointing up, rotated to face the requested direction.
const ROTATION: Record<Direction, number> = { up: 0, right: 90, down: 180, left: 270 }

export default function ArrowIcon({ dir }: { dir: Direction }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      style={{ transform: `rotate(${ROTATION[dir]}deg)` }}
    >
      <path d="M12 3 L20 12 H14.5 V21 H9.5 V12 H4 Z" fill="currentColor" />
    </svg>
  )
}
