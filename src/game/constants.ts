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

// Base points awarded for firing one arrow. Multiplied by the current combo streak.
export const BASE_ARROW_SCORE = 100
// Combo resets to 1 on any mistake. Cap prevents unreachable scores on big boards.
export const COMBO_CAP = 8

// Each level includes this many free hints. After that every hint costs score.
export const FREE_HINTS_PER_LEVEL = 2
export const EXTRA_HINT_SCORE_COST = 50

// Slide off animation speed in cells per second, with limits so tiny and huge boards both feel right.
export const EXIT_SPEED_CELLS_PER_SEC = 32
export const EXIT_MIN_MS = 350
export const EXIT_MAX_MS = 1100

// How long the blocked message and the red highlight on the blocking arrow stay visible.
export const FEEDBACK_MS = 1500

// Flat color palette for arrows. Colors cycle through this list by snake number so all
// four mirrored copies of a snake always share the same color.
export const ARROW_PALETTE: readonly string[] = [
  '#A855F7', // purple
  '#5B4BE0', // indigo
  '#2F6BEA', // blue
  '#3B82F6', // light blue
  '#0E9AB5', // teal
  '#14B8A6', // mint
  '#16A34A', // green
  '#65A30D', // lime
  '#F59E0B', // amber
  '#CA8A04', // mustard
  '#E11D2E', // red
  '#E11D74', // hot pink
  '#EC7FB0', // soft pink
  '#C026A3', // magenta
]
