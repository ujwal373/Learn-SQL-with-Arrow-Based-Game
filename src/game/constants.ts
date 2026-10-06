import type { Direction } from './types.ts'

// Row and column step for each direction. Row 0 is the top of the board.
export const DIRECTION_DELTAS: Record<Direction, { dr: number; dc: number }> = {
  up: { dr: -1, dc: 0 },
  down: { dr: 1, dc: 0 },
  left: { dr: 0, dc: -1 },
  right: { dr: 0, dc: 1 },
}

// Open decision 2: tapping a blocked arrow shakes it and costs a small amount of score.
// No life is lost. Set this to 0 for a shake only version.
export const BLOCKED_TAP_SCORE_PENALTY = 25

// Temporary scoring until step 4 adds combo and lives.
export const CLEAR_ARROW_SCORE = 100

// How long the fly off animation runs. The board passes this to CSS, so there is one source of truth.
export const EXIT_ANIMATION_MS = 600

// How long the blocked message and the red highlight on the blocking arrow stay visible.
export const BLOCKED_FEEDBACK_MS = 1200
