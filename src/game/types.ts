// Core types for the arrow board.

export type Direction = 'up' | 'down' | 'left' | 'right'

export interface Arrow {
  id: string
  row: number
  col: number
  dir: Direction
}

// An arrow as shown on screen. An exiting arrow has already been cleared and is
// only playing its fly off animation, so it no longer blocks anything.
export type ArrowStatus = 'active' | 'exiting'

export interface BoardArrow extends Arrow {
  status: ArrowStatus
}

export interface Board {
  rows: number
  cols: number
  arrows: Arrow[]
}
