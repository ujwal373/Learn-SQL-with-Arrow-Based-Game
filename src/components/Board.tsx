import type { CSSProperties } from 'react'
import { EXIT_ANIMATION_MS } from '../game/constants.ts'
import type { BoardArrow, Direction } from '../game/types.ts'
import ArrowIcon from './ArrowIcon.tsx'
import '../styles/board.css'

interface BoardProps {
  rows: number
  cols: number
  arrows: BoardArrow[]
  // The blocked arrow that was just tapped, and the arrow that is in its way.
  shakeId: string | null
  blockerId: string | null
  // Changes on every blocked tap so the shake animation can replay on the same arrow.
  shakeNonce: number
  onTap: (arrowId: string) => void
}

// Direction an arrow flies when it leaves the board.
const EXIT_VECTORS: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

export default function Board({
  rows,
  cols,
  arrows,
  shakeId,
  blockerId,
  shakeNonce,
  onTap,
}: BoardProps) {
  // Far enough, in cell widths, to leave the board from any starting cell.
  const travel = Math.max(rows, cols) + 2

  const boardStyle = {
    '--rows': rows,
    '--cols': cols,
    '--exit-ms': `${EXIT_ANIMATION_MS}ms`,
  } as CSSProperties

  return (
    <div className="board" style={boardStyle} role="group" aria-label="Arrow board">
      {arrows.map((a) => {
        const vector = EXIT_VECTORS[a.dir]

        const classes = ['arrow']
        if (a.status === 'exiting') classes.push('arrow--exiting')
        // Two identical animations that alternate, so a repeat tap restarts the shake
        // without remounting the button (remounting would drop keyboard focus).
        if (a.id === shakeId) classes.push(shakeNonce % 2 === 0 ? 'arrow--shake-a' : 'arrow--shake-b')
        if (a.id === blockerId) classes.push('arrow--blocker')

        const style = {
          left: `${(a.col / cols) * 100}%`,
          top: `${(a.row / rows) * 100}%`,
          width: `${100 / cols}%`,
          height: `${100 / rows}%`,
          '--dx': vector.x * travel,
          '--dy': vector.y * travel,
        } as CSSProperties

        return (
          <button
            key={a.id}
            type="button"
            className={classes.join(' ')}
            style={style}
            disabled={a.status === 'exiting'}
            aria-label={`Arrow in row ${a.row + 1}, column ${a.col + 1}, pointing ${a.dir}`}
            onClick={() => onTap(a.id)}
          >
            <span className="arrow__face">
              <ArrowIcon dir={a.dir} />
            </span>
          </button>
        )
      })}
    </div>
  )
}
