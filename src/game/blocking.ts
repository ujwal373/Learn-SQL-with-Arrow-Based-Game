import { headOf } from './arrow.ts'
import { DIRECTION_DELTAS } from './constants.ts'
import type { Arrow } from './types.ts'

const cellIndex = (row: number, col: number, cols: number) => row * cols + col

// Walks from the head of the arrow toward the edge of the board, in the direction it points,
// and returns the first arrow found in the way, or null if the path is clear.
// The arrow's own body counts too: a snake whose head points at its own tail can never leave,
// and the generator never produces one.
// Pass only active arrows. Arrows that are already sliding off must not block.
export function getBlocker(
  arrow: Arrow,
  activeArrows: Arrow[],
  rows: number,
  cols: number,
): Arrow | null {
  const head = headOf(arrow)
  const { dr, dc } = DIRECTION_DELTAS[arrow.dir]

  const owners = new Map<number, Arrow>()
  for (const other of activeArrows) {
    for (const cell of other.cells) owners.set(cellIndex(cell.row, cell.col, cols), other)
  }
  for (const cell of arrow.cells) owners.set(cellIndex(cell.row, cell.col, cols), arrow)

  let r = head.row + dr
  let c = head.col + dc
  while (r >= 0 && r < rows && c >= 0 && c < cols) {
    const hit = owners.get(cellIndex(r, c, cols))
    if (hit) return hit
    r += dr
    c += dc
  }
  return null
}

export function isBlocked(arrow: Arrow, activeArrows: Arrow[], rows: number, cols: number): boolean {
  return getBlocker(arrow, activeArrows, rows, cols) !== null
}

// For every arrow, the indexes of all arrows standing anywhere on its path to the edge.
// An arrow can leave once every one of them is gone. Built from one occupancy grid, so it is fast
// even for boards with hundreds of arrows.
function buildBlockers(arrows: Arrow[], rows: number, cols: number): number[][] {
  const owner = new Int32Array(rows * cols).fill(-1)
  arrows.forEach((arrow, i) => {
    for (const cell of arrow.cells) owner[cellIndex(cell.row, cell.col, cols)] = i
  })

  return arrows.map((arrow) => {
    const head = headOf(arrow)
    const { dr, dc } = DIRECTION_DELTAS[arrow.dir]
    const found = new Set<number>()
    let r = head.row + dr
    let c = head.col + dc
    while (r >= 0 && r < rows && c >= 0 && c < cols) {
      const o = owner[cellIndex(r, c, cols)]
      if (o !== -1) found.add(o)
      r += dr
      c += dc
    }
    return [...found]
  })
}

export interface BoardAnalysis {
  // Indexes of arrows that can never be cleared (part of a deadlock, or waiting on one).
  stuck: number[]
  // Number of arrows that are free to tap right now.
  freeCount: number
}

// Checks solvability by repeatedly removing arrows with nothing in their way (topological order).
// Clearing an arrow can only unblock others, never block new ones, so if any order works,
// removing free arrows in any order works too.
export function analyzeBoard(arrows: Arrow[], rows: number, cols: number): BoardAnalysis {
  const blockers = buildBlockers(arrows, rows, cols)
  const pending = blockers.map((list) => list.length)
  const dependents: number[][] = arrows.map(() => [])
  blockers.forEach((list, i) => {
    for (const j of list) dependents[j].push(i)
  })

  const queue: number[] = []
  pending.forEach((count, i) => {
    if (count === 0) queue.push(i)
  })
  const freeCount = queue.length

  const cleared = new Array<boolean>(arrows.length).fill(false)
  while (queue.length > 0) {
    const i = queue.pop()!
    cleared[i] = true
    for (const d of dependents[i]) {
      pending[d] -= 1
      if (pending[d] === 0) queue.push(d)
    }
  }

  const stuck: number[] = []
  cleared.forEach((done, i) => {
    if (!done) stuck.push(i)
  })
  return { stuck, freeCount }
}

export function canClearAll(arrows: Arrow[], rows: number, cols: number): boolean {
  return analyzeBoard(arrows, rows, cols).stuck.length === 0
}

// Picks the arrow to highlight for a hint: a free arrow that unblocks the most other arrows.
export function findHintArrow(activeArrows: Arrow[], rows: number, cols: number): Arrow | null {
  const blockers = buildBlockers(activeArrows, rows, cols)
  const unblocks = new Array<number>(activeArrows.length).fill(0)
  for (const list of blockers) {
    for (const j of list) unblocks[j] += 1
  }

  let best = -1
  blockers.forEach((list, i) => {
    if (list.length === 0 && (best === -1 || unblocks[i] > unblocks[best])) best = i
  })
  return best === -1 ? null : activeArrows[best]
}
