import { DIRECTION_DELTAS } from './constants.ts'
import type { Arrow } from './types.ts'

const cellKey = (row: number, col: number) => `${row},${col}`

// Walks from the arrow toward the edge of the board in its direction and returns
// the first active arrow in the way, or null if the path is clear.
// Pass only active arrows. Arrows that are already flying off must not block.
export function getBlocker(
  arrow: Arrow,
  activeArrows: Arrow[],
  rows: number,
  cols: number,
): Arrow | null {
  const { dr, dc } = DIRECTION_DELTAS[arrow.dir]

  const occupied = new Map<string, Arrow>()
  for (const other of activeArrows) {
    if (other.id !== arrow.id) occupied.set(cellKey(other.row, other.col), other)
  }

  let r = arrow.row + dr
  let c = arrow.col + dc
  while (r >= 0 && r < rows && c >= 0 && c < cols) {
    const hit = occupied.get(cellKey(r, c))
    if (hit) return hit
    r += dr
    c += dc
  }
  return null
}

export function isBlocked(
  arrow: Arrow,
  activeArrows: Arrow[],
  rows: number,
  cols: number,
): boolean {
  return getBlocker(arrow, activeArrows, rows, cols) !== null
}

// Returns true if every arrow can eventually be cleared.
// Greedy is enough: clearing an arrow can only unblock others, never block new ones,
// so if any order works then repeatedly clearing any free arrow also works.
export function canClearAll(arrows: Arrow[], rows: number, cols: number): boolean {
  let remaining = [...arrows]
  while (remaining.length > 0) {
    const free = remaining.find((a) => !isBlocked(a, remaining, rows, cols))
    if (!free) return false
    remaining = remaining.filter((a) => a.id !== free.id)
  }
  return true
}
