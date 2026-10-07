import { useImperativeHandle } from 'react'
import type { Ref } from 'react'
import type { Bounds } from '../game/arrow.ts'
import type { BoardArrow } from '../game/types.ts'
import ArrowShape from './ArrowShape.tsx'
import { FitIcon, MinusIcon, PlusIcon } from './icons.tsx'
import { useZoomPan } from './useZoomPan.ts'
import '../styles/board.css'

export interface BoardHandle {
  // Moves the camera to a cell if it is off screen, used to show hints on large boards.
  showCell: (row: number, col: number) => void
}

interface BoardProps {
  rows: number
  cols: number
  arrows: BoardArrow[]
  // The cells covered by the pattern when the level started. The camera starts zoomed to fit them.
  focus: Bounds
  // Changes whenever a new board is loaded, so the camera refits.
  boardKey: string | number
  hintId: string | null
  // The arrow that was tapped while blocked, and the arrow that was in its way.
  shakeId: string | null
  blockerId: string | null
  // Changes on every blocked tap so the shake can replay on the same arrow.
  shakeNonce: number
  onTap: (arrowId: string) => void
  ref?: Ref<BoardHandle>
}

export default function Board({
  rows,
  cols,
  arrows,
  focus,
  boardKey,
  hintId,
  shakeId,
  blockerId,
  shakeNonce,
  onTap,
  ref,
}: BoardProps) {
  const zoom = useZoomPan(cols, rows, focus, boardKey, onTap)

  useImperativeHandle(ref, () => ({
    showCell: (row, col) => zoom.ensureVisible(col + 0.5, row + 0.5),
  }))

  return (
    <div
      className="board"
      ref={zoom.containerRef}
      onPointerDown={zoom.onPointerDown}
      onPointerMove={zoom.onPointerMove}
      onPointerUp={zoom.onPointerUp}
      onPointerCancel={zoom.onPointerCancel}
    >
      {zoom.ready && (
        <svg
          ref={zoom.svgRef}
          className="board__svg"
          role="group"
          aria-label="Arrow board. Scroll or pinch to zoom, drag to move."
        >
          <defs>
            <pattern id="dots" width="1" height="1" patternUnits="userSpaceOnUse">
              <circle cx="0.5" cy="0.5" r="0.07" className="board__dot" />
            </pattern>
          </defs>
          <rect x="0" y="0" width={cols} height={rows} fill="url(#dots)" />

          {arrows.map((arrow) => (
            <ArrowShape
              key={arrow.id}
              arrow={arrow}
              rows={rows}
              cols={cols}
              hinted={arrow.id === hintId}
              blocker={arrow.id === blockerId}
              shakeClass={
                arrow.id === shakeId ? (shakeNonce % 2 === 0 ? 'arrow--shake-a' : 'arrow--shake-b') : ''
              }
              onActivate={onTap}
            />
          ))}
        </svg>
      )}

      <div className="zoom-controls">
        <button type="button" className="icon-btn" onClick={zoom.zoomIn} aria-label="Zoom in">
          <PlusIcon />
        </button>
        <button type="button" className="icon-btn" onClick={zoom.zoomOut} aria-label="Zoom out">
          <MinusIcon />
        </button>
        <button type="button" className="icon-btn" onClick={zoom.fit} aria-label="Fit board to screen">
          <FitIcon />
        </button>
      </div>
    </div>
  )
}
