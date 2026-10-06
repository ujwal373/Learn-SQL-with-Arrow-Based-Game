import { getBlocker, isBlocked } from './blocking.ts'
import { mulberry32 } from './rng.ts'
import type { Arrow, Board, Direction } from './types.ts'

export interface LevelConfig {
  level: number
  rows: number
  cols: number
  arrowCount: number
}

// Arrow counts follow the level design draft:
// levels 1 to 3 use 4 to 6 arrows, 4 to 6 use 6 to 9, 7 to 9 use 9 to 12, level 10 and up use 12 or more.
// Grid size grows with each tier so the board never feels crowded.
const TIERS = [
  { minArrows: 4, maxArrows: 6, size: 5 },
  { minArrows: 6, maxArrows: 9, size: 6 },
  { minArrows: 9, maxArrows: 12, size: 7 },
]
const ENDLESS_SIZE = 8
const ENDLESS_START_ARROWS = 12
// Never fill more than half of the cells, so there is always room to maneuver.
const MAX_FILL = 0.5

const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right']
const MAX_ATTEMPTS = 200

export function getLevelConfig(level: number): LevelConfig {
  const lvl = Math.max(1, Math.floor(level))

  if (lvl <= 9) {
    const tier = TIERS[Math.floor((lvl - 1) / 3)]
    const stepInTier = (lvl - 1) % 3
    const arrowCount =
      tier.minArrows + Math.floor((stepInTier * (tier.maxArrows - tier.minArrows)) / 2)
    return { level: lvl, rows: tier.size, cols: tier.size, arrowCount }
  }

  const cap = Math.floor(ENDLESS_SIZE * ENDLESS_SIZE * MAX_FILL)
  const arrowCount = Math.min(cap, ENDLESS_START_ARROWS + (lvl - 10))
  return { level: lvl, rows: ENDLESS_SIZE, cols: ENDLESS_SIZE, arrowCount }
}

// How the generator guarantees a solvable board:
// arrows are placed one at a time, and each new arrow must have a clear path to the edge
// at the moment it is placed. Later arrows may land in the path of earlier ones, which is
// what creates blocking. Clearing the arrows in reverse placement order always works,
// so no deadlock (two arrows pointing at each other, for example) can ever be generated.
function tryBuild(config: LevelConfig, seed: number): Arrow[] | null {
  const rand = mulberry32(seed)
  const placed: Arrow[] = []
  const taken = new Set<string>()

  for (let i = 0; i < config.arrowCount; i++) {
    let arrow: Arrow | null = null

    for (let tries = 0; tries < 100 && arrow === null; tries++) {
      const row = Math.floor(rand() * config.rows)
      const col = Math.floor(rand() * config.cols)
      if (taken.has(`${row},${col}`)) continue

      const dir = DIRECTIONS[Math.floor(rand() * DIRECTIONS.length)]
      const candidate: Arrow = { id: `L${config.level}-${i + 1}`, row, col, dir }
      if (getBlocker(candidate, placed, config.rows, config.cols) === null) {
        arrow = candidate
      }
    }

    if (arrow === null) return null
    placed.push(arrow)
    taken.add(`${arrow.row},${arrow.col}`)
  }

  return placed
}

// Builds the board for a level. The same level number always gives the same board.
// Boards where almost nothing is blocked are rejected, because the puzzle would have no
// decisions in it. Each attempt uses a different seed derived from the level number.
export function generateBoard(level: number): Board {
  const config = getLevelConfig(level)
  const minBlocked = Math.max(1, Math.floor(config.arrowCount / 4))
  let fallback: Arrow[] | null = null

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const arrows = tryBuild(config, config.level * 7919 + attempt)
    if (arrows === null) continue
    fallback = arrows

    const blockedCount = arrows.filter((a) => isBlocked(a, arrows, config.rows, config.cols)).length
    if (blockedCount >= minBlocked) {
      return { rows: config.rows, cols: config.cols, arrows }
    }
  }

  // Extremely unlikely. A solvable board that is slightly too easy beats a crash.
  if (fallback !== null) return { rows: config.rows, cols: config.cols, arrows: fallback }
  throw new Error(`Could not generate a board for level ${level}`)
}
