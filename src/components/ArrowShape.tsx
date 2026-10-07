import { memo } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { getExitInfo } from '../game/exit.ts'
import type { BoardArrow, Direction } from '../game/types.ts'

interface ArrowShapeProps {
  arrow: BoardArrow
  rows: number
  cols: number
  hinted: boolean
  // True for the arrow that stopped the last blocked tap.
  blocker: boolean
  // Set on the arrow that was tapped while blocked. The class alternates between two identical
  // animations so a repeat tap on the same arrow restarts the shake.
  shakeClass: string
  onActivate: (id: string) => void
}

// The arrow head is one triangle drawn pointing up and rotated into place.
const ROTATION: Record<Direction, number> = { up: 0, right: 90, down: 180, left: 270 }
const SLIDE_EASING = 'cubic-bezier(0.5, 0, 0.9, 0.5)'

// One arrow, drawn in grid units: one cell is one unit, and a cell center is at (col + 0.5, row + 0.5).
function ArrowShape({ arrow, rows, cols, hinted, blocker, shakeClass, onActivate }: ArrowShapeProps) {
  const points = arrow.cells.map((c) => `${c.col + 0.5} ${c.row + 0.5}`)
  const body = `M${points.join(' L')}`
  const head = arrow.cells[arrow.cells.length - 1]
  const hx = head.col + 0.5
  const hy = head.row + 0.5
  const exiting = arrow.status === 'exiting'

  // Sliding off: the line is redrawn as a longer path that continues straight out past the head,
  // and only a window of it (the body length) is visible. Moving the window along the path makes
  // the tail follow the head around the bends, like a snake.
  let bodyPath = body
  let bodyStyle: CSSProperties | undefined
  let headStyle: CSSProperties | undefined
  if (exiting) {
    const exit = getExitInfo(arrow, rows, cols)
    bodyPath = `${body} L${hx + exit.dx * exit.slide} ${hy + exit.dy * exit.slide}`
    const transition = `${exit.durationMs}ms ${SLIDE_EASING}`
    bodyStyle = {
      strokeDasharray: `${exit.bodyLength} ${exit.bodyLength + exit.slide + 2}`,
      strokeDashoffset: -exit.slide,
      transition: `stroke-dashoffset ${transition}`,
    }
    headStyle = {
      transform: `translate(${exit.dx * exit.slide}px, ${exit.dy * exit.slide}px)`,
      transition: `transform ${transition}`,
    }
  }

  const classes = ['arrow']
  if (hinted) classes.push('arrow--hint')
  if (blocker) classes.push('arrow--blocker')
  if (shakeClass) classes.push(shakeClass)
  if (exiting) classes.push('arrow--exiting')

  const onKeyDown = (e: KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onActivate(arrow.id)
    }
  }

  return (
    <g
      className={classes.join(' ')}
      data-arrow-id={exiting ? undefined : arrow.id}
      role="button"
      tabIndex={exiting ? -1 : 0}
      aria-label={`Arrow with head at row ${head.row + 1}, column ${head.col + 1}, pointing ${arrow.dir}`}
      onKeyDown={onKeyDown}
    >
      {/* Soft glow behind the arrow for hints, blocked feedback and keyboard focus. */}
      <path className="arrow__halo" d={body} />
      <path className="arrow__line" d={bodyPath} style={bodyStyle} />
      <g style={headStyle}>
        <polygon
          className="arrow__head"
          points="0,-0.55 0.27,0.05 -0.27,0.05"
          transform={`translate(${hx} ${hy}) rotate(${ROTATION[arrow.dir]})`}
        />
      </g>
      {/* Invisible wide stroke, so thin arrows are easy to hit with a finger. */}
      <path className="arrow__hit" d={body} />
    </g>
  )
}

export default memo(ArrowShape)
