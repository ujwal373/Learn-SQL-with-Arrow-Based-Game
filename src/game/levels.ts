import { makeArrow } from './arrow.ts'
import { analyzeBoard } from './blocking.ts'
import { mulberry32 } from './rng.ts'
import type { Arrow, Board, Cell } from './types.ts'

// How a level is built
//
// 1. Pick a shape (square, diamond, circle, cross or ring) for ONE quadrant of the board.
// 2. Place snakes into that quadrant, starting near the center and working outward. A snake is a
//    path of two or more connected cells that bends at random.
// 3. Every snake is mirrored left to right and top to bottom, so the finished pattern is
//    symmetrical in both directions, like a mandala sitting in the middle of a large dot grid.
// 4. A snake is only accepted if its head has a clear path to the edge at the moment it is placed
//    (nothing placed earlier is in the way). Snakes placed later may land in front of earlier ones,
//    which is what creates blocking. Clearing the arrows in reverse placement order always works,
//    so no board can ever be deadlocked. In play this means the player peels the pattern from the
//    outside in.
//
// The same level number always produces the same board.

export type ShapeName = 'square' | 'diamond' | 'circle' | 'cross' | 'ring'

export interface LevelConfig {
  level: number
  // Side length of the area for one quadrant, in cells.
  domain: number
  // How many cells of that area the pattern fills. This rises by a steady amount every level,
  // whatever the shape, so the number of arrows keeps rising too.
  cellTarget: number
  // Empty dot grid around the pattern, in cells, on every side.
  margin: number
  rows: number
  cols: number
  shape: ShapeName
  minLen: number
  maxLen: number
}

const SHAPES: ShapeName[] = ['square', 'circle', 'cross', 'ring', 'diamond']
const MAX_DOMAIN = 22
const MAX_FILL = 0.9
const HOLE_CHANCE = 0.06
const STRAIGHT_BIAS = 0.55
// How much the placement order is shuffled. Zero is a strict center to edge order.
const ORDER_NOISE = 2
// Different random shapes tried for a start cell before giving up on it.
const SHAPE_TRIES = 6
const MAX_ATTEMPTS = 40

const NEIGHBOURS: Cell[] = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
]

export function getLevelConfig(level: number): LevelConfig {
  const lvl = Math.max(1, Math.floor(level))
  // The quadrant holds about m by m cells, where m grows by half a cell every level:
  // 4 cells on level 1, 9 on level 3, 16 on level 5 and so on. The area it sits in is one
  // cell bigger than that, so the shape has room to show its outline.
  const m = 1 + (lvl + 1) / 2
  const domain = Math.min(MAX_DOMAIN, Math.ceil(m) + 1)
  const cellTarget = Math.min(Math.floor(domain * domain * MAX_FILL), Math.round(m * m))
  const margin = 2 + Math.floor(domain / 3)
  const size = domain * 2 + margin * 2
  return {
    level: lvl,
    domain,
    cellTarget,
    margin,
    rows: size,
    cols: size,
    shape: SHAPES[lvl % SHAPES.length],
    minLen: 2,
    // Snakes get longer as levels rise, so later boards look more tangled.
    maxLen: 3 + Math.min(5, Math.floor(lvl / 8)),
  }
}

// Orders cells by how well they fit the shape. The pattern is made of the best fitting cells, so
// every shape fills the same number of cells and only the outline differs.
// dr and dc are the distances from the center lines of the board (0 is the cell next to the center).
function shapeMetric(shape: ShapeName, dr: number, dc: number, n: number): number {
  switch (shape) {
    case 'diamond':
      return dr + dc
    case 'circle':
      return (dr + 0.5) ** 2 + (dc + 0.5) ** 2
    case 'cross':
      // Cells near either center line first, which grows thick arms along the axes.
      return Math.min(dr, dc) * 100 + Math.max(dr, dc)
    case 'ring': {
      const distance = Math.hypot(dr + 0.5, dc + 0.5)
      // Cells in the middle come last, so the ring has a hole until the pattern gets very large.
      return distance < n * 0.22 ? 1000 + distance : distance
    }
    default:
      return Math.max(dr, dc)
  }
}

// Quadrant coordinates: row 0 and column 0 are the outer corner, the center of the board is at the
// far corner (n - 1, n - 1).
function makeMask(config: LevelConfig, rand: () => number): boolean[][] {
  const n = config.domain
  const candidates: { r: number; c: number; key: number }[] = []
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      // Random holes make larger patterns less perfect. They are mirrored with everything else.
      if (n >= 6 && rand() < HOLE_CHANCE) continue
      // The noise is smaller than the gaps between metric values, so it only breaks ties.
      candidates.push({ r, c, key: shapeMetric(config.shape, n - 1 - r, n - 1 - c, n) + rand() * 0.5 })
    }
  }
  candidates.sort((a, b) => a.key - b.key)

  const mask: boolean[][] = Array.from({ length: n }, () => new Array<boolean>(n).fill(false))
  for (const { r, c } of candidates.slice(0, config.cellTarget)) mask[r][c] = true
  return mask
}

type Mirror = (cell: Cell, rows: number, cols: number) => Cell

// The four copies of every snake: the original and its mirror images.
const MIRRORS: Mirror[] = [
  (cell) => cell,
  (cell, _rows, cols) => ({ row: cell.row, col: cols - 1 - cell.col }),
  (cell, rows) => ({ row: rows - 1 - cell.row, col: cell.col }),
  (cell, rows, cols) => ({ row: rows - 1 - cell.row, col: cols - 1 - cell.col }),
]

const FREE = -1
const OUTSIDE = -2
const RESERVED = -3
const TAKEN = -4

// Returns a solvable board, or null if nothing could be placed for this random seed.
function buildBoard(config: LevelConfig, seed: number): Board | null {
  const rand = mulberry32(seed)
  const mask = makeMask(config, rand)
  const { rows, cols, margin, domain: n } = config

  // State of every quadrant cell: free, outside the shape (or dropped), part of the snake being
  // grown right now, or part of a snake that has been placed.
  const owner: number[][] = mask.map((line) => line.map((inside) => (inside ? FREE : OUTSIDE)))
  // Board cells covered by arrows placed so far, across all four quadrants.
  const occupied = new Uint8Array(rows * cols)
  const arrows: Arrow[] = []

  const isFree = (r: number, c: number) => r >= 0 && c >= 0 && r < n && c < n && owner[r][c] === FREE

  // Grows a path from one end, bending at random but preferring to go straight.
  function extend(path: Cell[], atEnd: boolean, target: number): void {
    while (path.length < target) {
      const tip = atEnd ? path[path.length - 1] : path[0]
      const options = NEIGHBOURS.map((d) => ({ row: tip.row + d.row, col: tip.col + d.col })).filter(
        (cell) => isFree(cell.row, cell.col),
      )
      if (options.length === 0) return

      let next = options[Math.floor(rand() * options.length)]
      const prev = atEnd ? path[path.length - 2] : path[1]
      if (prev !== undefined && rand() < STRAIGHT_BIAS) {
        const straight = options.find(
          (o) => o.row === tip.row * 2 - prev.row && o.col === tip.col * 2 - prev.col,
        )
        if (straight) next = straight
      }

      owner[next.row][next.col] = RESERVED
      if (atEnd) path.push(next)
      else path.unshift(next)
    }
  }

  function growSnake(start: Cell): Cell[] {
    const path: Cell[] = [start]
    owner[start.row][start.col] = RESERVED
    const target = config.minLen + Math.floor(rand() * (config.maxLen - config.minLen + 1))
    extend(path, true, target)
    if (path.length < target) extend(path, false, target)
    return path
  }

  // Tries both head positions. Accepts the snake if all four mirrored copies have a clear path.
  function tryPlace(path: Cell[], snakeNumber: number): boolean {
    const reverseFirst = rand() < 0.5
    for (const reverse of [reverseFirst, !reverseFirst]) {
      // Reversing the cell order moves the head to the other end of the snake.
      const ordered = reverse ? [...path].reverse() : path
      const copies = MIRRORS.map((mirror) =>
        ordered.map((cell) => mirror({ row: cell.row + margin, col: cell.col + margin }, rows, cols)),
      )

      const family = new Set<number>()
      for (const cells of copies) for (const cell of cells) family.add(cell.row * cols + cell.col)

      const clear = copies.every((cells) => {
        const head = cells[cells.length - 1]
        const before = cells[cells.length - 2]
        const dr = head.row - before.row
        const dc = head.col - before.col
        let r = head.row + dr
        let c = head.col + dc
        while (r >= 0 && r < rows && c >= 0 && c < cols) {
          const idx = r * cols + c
          if (occupied[idx] === 1 || family.has(idx)) return false
          r += dr
          c += dc
        }
        return true
      })
      if (!clear) continue

      copies.forEach((cells, i) => {
        arrows.push(makeArrow(`L${config.level}-${snakeNumber}-${i + 1}`, cells))
        for (const cell of cells) occupied[cell.row * cols + cell.col] = 1
      })
      for (const cell of path) owner[cell.row][cell.col] = TAKEN
      return true
    }
    return false
  }

  // Start cells, nearest the center first with a little noise so the layers are not perfectly even.
  const order: Cell[] = []
  mask.forEach((line, r) => line.forEach((inside, c) => inside && order.push({ row: r, col: c })))
  const keyed = order.map((cell) => ({
    cell,
    key: n - 1 - cell.row + (n - 1 - cell.col) + rand() * ORDER_NOISE,
  }))
  keyed.sort((a, b) => a.key - b.key)

  let snakeNumber = 0
  for (const { cell: start } of keyed) {
    if (owner[start.row][start.col] !== FREE) continue

    let placed = false
    for (let attempt = 0; attempt < SHAPE_TRIES && !placed; attempt++) {
      const path = growSnake(start)
      if (path.length >= config.minLen) {
        placed = tryPlace(path, snakeNumber + 1)
        if (placed) snakeNumber += 1
      }
      if (!placed) {
        for (const cell of path) owner[cell.row][cell.col] = FREE
        // A cell with no free neighbour can never start a snake.
        if (path.length < config.minLen) break
      }
    }
    // Leave the cell empty if nothing fit.
    if (!placed) owner[start.row][start.col] = OUTSIDE
  }

  return arrows.length > 0 ? { rows, cols, arrows } : null
}

// Builds the board for a level. Boards where almost nothing is blocked are rejected, because the
// puzzle would have no decisions in it.
export function generateBoard(level: number): Board {
  const config = getLevelConfig(level)
  let fallback: Board | null = null

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const board = buildBoard(config, config.level * 7919 + attempt * 104729)
    if (board === null) continue
    fallback = board

    const { freeCount } = analyzeBoard(board.arrows, board.rows, board.cols)
    const blocked = board.arrows.length - freeCount
    // Level 1 is tiny and every arrow there points outward, so it may be fully free.
    const minBlocked = config.level === 1 ? 0 : Math.max(1, Math.floor(board.arrows.length / 4))
    if (blocked >= minBlocked) return board
  }

  // Extremely unlikely. A solvable board that is slightly too easy beats a crash.
  if (fallback !== null) return fallback
  throw new Error(`Could not generate a board for level ${level}`)
}
