import type { Arrow, Cell, Direction } from './types.ts'

export function directionBetween(from: Cell, to: Cell): Direction {
  const dr = to.row - from.row
  const dc = to.col - from.col
  if (dr === -1 && dc === 0) return 'up'
  if (dr === 1 && dc === 0) return 'down'
  if (dr === 0 && dc === -1) return 'left'
  if (dr === 0 && dc === 1) return 'right'
  throw new Error('Arrow cells must be orthogonal neighbours')
}

// Builds an arrow from a tail to head list of cells. The direction comes from the last segment.
export function makeArrow(id: string, cells: Cell[]): Arrow {
  if (cells.length < 2) throw new Error('An arrow needs at least two cells')
  for (let i = 1; i < cells.length; i++) directionBetween(cells[i - 1], cells[i])
  return { id, cells, dir: directionBetween(cells[cells.length - 2], cells[cells.length - 1]) }
}

export function headOf(arrow: Arrow): Cell {
  return arrow.cells[arrow.cells.length - 1]
}

export interface Bounds {
  minRow: number
  maxRow: number
  minCol: number
  maxCol: number
}

// The smallest rectangle of cells that contains every arrow. The camera uses it to start zoomed in on
// the pattern instead of on the whole dot grid.
export function boundsOf(arrows: Arrow[]): Bounds {
  let minRow = Infinity
  let maxRow = -Infinity
  let minCol = Infinity
  let maxCol = -Infinity
  for (const arrow of arrows) {
    for (const cell of arrow.cells) {
      minRow = Math.min(minRow, cell.row)
      maxRow = Math.max(maxRow, cell.row)
      minCol = Math.min(minCol, cell.col)
      maxCol = Math.max(maxCol, cell.col)
    }
  }
  return { minRow, maxRow, minCol, maxCol }
}
