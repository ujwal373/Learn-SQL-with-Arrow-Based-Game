import type { Direction } from './types.ts'

// Row and column step for each direction. Row 0 is the top of the board.
export const DIRECTION_DELTAS: Record<Direction, { dr: number; dc: number }> = {
  up: { dr: -1, dc: 0 },
  down: { dr: 1, dc: 0 },
  left: { dr: 0, dc: -1 },
  right: { dr: 0, dc: 1 },
}

// Lives belong to a game (a run), not to a level. They carry over from level to level.
export const LIVES_PER_GAME = 3

// Tapping an arrow that is blocked by another arrow costs this many lives.
export const BLOCKED_TAP_LIVES_LOST = 1

// Temporary scoring until step 4 adds the combo multiplier.
export const CLEAR_ARROW_SCORE = 100

// Each level includes this many free hints. After that every hint costs score.
export const FREE_HINTS_PER_LEVEL = 2
export const EXTRA_HINT_SCORE_COST = 50

// Slide off animation speed in cells per second, with limits so tiny and huge boards both feel right.
export const EXIT_SPEED_CELLS_PER_SEC = 32
export const EXIT_MIN_MS = 350
export const EXIT_MAX_MS = 1100

// How long the blocked message and the red highlight on the blocking arrow stay visible.
export const FEEDBACK_MS = 1500
