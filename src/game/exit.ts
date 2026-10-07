import { headOf } from './arrow.ts'
import {
  DIRECTION_DELTAS,
  EXIT_MAX_MS,
  EXIT_MIN_MS,
  EXIT_SPEED_CELLS_PER_SEC,
} from './constants.ts'
import type { Arrow } from './types.ts'

export interface ExitInfo {
  // Length of the drawn line, from tail center to head center, in cells.
  bodyLength: number
  // How far the arrow slides, in cells, until it has completely left the board.
  slide: number
  durationMs: number
  // Unit vector of the head direction.
  dx: number
  dy: number
}

// The head slides straight out along its direction and the body follows the same trail,
// so the tail leaves after travelling the body length plus the open cells ahead of the head.
export function getExitInfo(arrow: Arrow, rows: number, cols: number): ExitInfo {
  const head = headOf(arrow)
  const { dr, dc } = DIRECTION_DELTAS[arrow.dir]

  let cellsAhead: number
  if (dr === -1) cellsAhead = head.row
  else if (dr === 1) cellsAhead = rows - 1 - head.row
  else if (dc === -1) cellsAhead = head.col
  else cellsAhead = cols - 1 - head.col

  const bodyLength = arrow.cells.length - 1
  const slide = bodyLength + cellsAhead + 1
  const durationMs = Math.min(
    EXIT_MAX_MS,
    Math.max(EXIT_MIN_MS, (slide / EXIT_SPEED_CELLS_PER_SEC) * 1000),
  )
  return { bodyLength, slide, durationMs, dx: dc, dy: dr }
}
