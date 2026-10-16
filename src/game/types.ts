// Core types for the arrow board.

export type Direction = 'up' | 'down' | 'left' | 'right'

export interface Cell {
  row: number
  col: number
}

// An arrow is a snake: a path of orthogonally connected cells ordered from tail to head.
// It points the way its last segment points, and that is the way it slides out of the board.
export interface Arrow {
  id: string
  cells: Cell[]
  dir: Direction
  color?: string
}

// An exiting arrow has already been cleared and is only playing its slide off animation,
// so it no longer blocks anything.
export type ArrowStatus = 'active' | 'exiting'

export interface BoardArrow extends Arrow {
  status: ArrowStatus
}

export interface Board {
  rows: number
  cols: number
  arrows: Arrow[]
}
