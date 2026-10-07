import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Bounds } from '../game/arrow.ts'

// Zoom and pan for the board.
//
// The camera is three numbers: k (screen pixels per grid cell) and the grid point (cx, cy) shown
// in the middle of the screen. They live in a ref and are written straight into the SVG viewBox,
// so panning and pinching never re-render the hundreds of arrows.
//
// Input: mouse wheel and trackpad pinch zoom around the pointer, dragging pans, two fingers pinch
// and pan, and a short press that barely moves counts as a tap on the arrow under the finger.

const FIT_PADDING_PX = 24
// Empty cells shown around the pattern when the camera is fitted to it.
const FIT_MARGIN_CELLS = 2
// The player can zoom out until the whole dot grid fits, with a little room to spare.
const MIN_ZOOM_VS_WHOLE_GRID = 0.9
const MAX_PIXELS_PER_CELL = 120
const BUTTON_ZOOM_STEP = 1.4
// Movement beyond this many pixels turns a press into a drag instead of a tap.
const DRAG_THRESHOLD_PX = 6

interface View {
  k: number
  cx: number
  cy: number
}

interface Gesture {
  startX: number
  startY: number
  dragging: boolean
  // True once a second finger touched down. A pinch never counts as a tap.
  multi: boolean
  tapTarget: string | null
  lastDistance: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function useZoomPan(
  worldWidth: number,
  worldHeight: number,
  // The pattern the camera fits to. The rest of the dot grid is reached by zooming out.
  focus: Bounds,
  // Changes when a new board is loaded, so the camera refits.
  resetKey: string | number,
  onTap: (arrowId: string) => void,
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [ready, setReady] = useState(false)

  const view = useRef<View>({ k: 1, cx: worldWidth / 2, cy: worldHeight / 2 })
  const size = useRef({ w: 0, h: 0 })
  const world = useRef({ w: worldWidth, h: worldHeight })
  const focusRef = useRef(focus)
  // True while the camera is still in its "fit everything" state, so a resize can refit it.
  const fitted = useRef(true)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<Gesture | null>(null)
  const tapHandler = useRef(onTap)

  useEffect(() => {
    tapHandler.current = onTap
  }, [onTap])

  const apply = useCallback(() => {
    const svg = svgRef.current
    const { w, h } = size.current
    if (!svg || w === 0 || h === 0) return
    const { k, cx, cy } = view.current
    svg.setAttribute('viewBox', `${cx - w / (2 * k)} ${cy - h / (2 * k)} ${w / k} ${h / k}`)
  }, [])

  // Pixels per cell that show the whole pattern, and the smallest zoom that shows the whole grid.
  const fitScale = useCallback(() => {
    const { w, h } = size.current
    const f = focusRef.current
    const cellsWide = f.maxCol - f.minCol + 1 + FIT_MARGIN_CELLS * 2
    const cellsHigh = f.maxRow - f.minRow + 1 + FIT_MARGIN_CELLS * 2
    return Math.max(1, Math.min((w - FIT_PADDING_PX) / cellsWide, (h - FIT_PADDING_PX) / cellsHigh))
  }, [])

  const minScale = useCallback(() => {
    const { w, h } = size.current
    const { w: ww, h: wh } = world.current
    return Math.min(fitScale(), Math.min(w / ww, h / wh) * MIN_ZOOM_VS_WHOLE_GRID)
  }, [fitScale])

  const keepInside = useCallback(() => {
    const v = view.current
    v.cx = clamp(v.cx, 0, world.current.w)
    v.cy = clamp(v.cy, 0, world.current.h)
  }, [])

  const fit = useCallback(() => {
    const f = focusRef.current
    view.current = {
      k: fitScale(),
      cx: (f.minCol + f.maxCol + 1) / 2,
      cy: (f.minRow + f.maxRow + 1) / 2,
    }
    fitted.current = true
    apply()
  }, [apply, fitScale])

  // Zoom by a factor, keeping the grid point under screen position (px, py) where it is.
  const zoomAt = useCallback(
    (factor: number, px: number, py: number) => {
      const { w, h } = size.current
      const v = view.current
      const k = clamp(v.k * factor, minScale(), MAX_PIXELS_PER_CELL)
      const gx = v.cx + (px - w / 2) / v.k
      const gy = v.cy + (py - h / 2) / v.k
      v.cx = gx - (px - w / 2) / k
      v.cy = gy - (py - h / 2) / k
      v.k = k
      keepInside()
      fitted.current = false
      apply()
    },
    [apply, keepInside, minScale],
  )

  const zoomIn = useCallback(() => {
    zoomAt(BUTTON_ZOOM_STEP, size.current.w / 2, size.current.h / 2)
  }, [zoomAt])

  const zoomOut = useCallback(() => {
    zoomAt(1 / BUTTON_ZOOM_STEP, size.current.w / 2, size.current.h / 2)
  }, [zoomAt])

  // Centers the camera on a grid point if it is close to, or past, the edge of the screen.
  const ensureVisible = useCallback(
    (gridX: number, gridY: number) => {
      const { w, h } = size.current
      const v = view.current
      const halfW = (w / v.k) * 0.4
      const halfH = (h / v.k) * 0.4
      if (Math.abs(gridX - v.cx) > halfW || Math.abs(gridY - v.cy) > halfH) {
        v.cx = gridX
        v.cy = gridY
        keepInside()
        fitted.current = false
        apply()
      }
    },
    [apply, keepInside],
  )

  // Track the size of the board area.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      size.current = { w: el.clientWidth, h: el.clientHeight }
      if (size.current.w === 0 || size.current.h === 0) return
      if (fitted.current) fit()
      else apply()
      setReady(true)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [apply, fit])

  // A new board always starts fitted to the screen.
  useLayoutEffect(() => {
    world.current = { w: worldWidth, h: worldHeight }
    focusRef.current = focus
    if (size.current.w > 0) fit()
    else fitted.current = true
  }, [worldWidth, worldHeight, focus, resetKey, fit])

  // Re-apply the camera when the SVG first appears (it is not drawn until the size is known).
  useLayoutEffect(() => {
    if (ready) apply()
  }, [ready, apply])

  // The wheel listener is attached by hand because React's wheel handlers are passive, and
  // preventing the page from scrolling needs a non passive one.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      zoomAt(Math.exp(-e.deltaY * 0.0018), e.clientX - rect.left, e.clientY - rect.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointers.current.size === 1) {
      const target = (e.target as Element).closest('[data-arrow-id]')
      gesture.current = {
        startX: e.clientX,
        startY: e.clientY,
        dragging: false,
        multi: false,
        tapTarget: target ? target.getAttribute('data-arrow-id') : null,
        lastDistance: 0,
      }
    } else if (gesture.current) {
      const [a, b] = [...pointers.current.values()]
      gesture.current.multi = true
      gesture.current.dragging = true
      gesture.current.lastDistance = Math.hypot(a.x - b.x, a.y - b.y)
    }
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const previous = pointers.current.get(e.pointerId)
    const g = gesture.current
    if (!previous || !g) return
    const current = { x: e.clientX, y: e.clientY }
    pointers.current.set(e.pointerId, current)
    const v = view.current

    if (pointers.current.size >= 2) {
      // Pinch: zoom by the change in finger distance, and pan by how far the midpoint moved.
      const [a, b] = [...pointers.current.values()]
      const distance = Math.hypot(a.x - b.x, a.y - b.y)
      const rect = e.currentTarget.getBoundingClientRect()
      const midX = (a.x + b.x) / 2 - rect.left
      const midY = (a.y + b.y) / 2 - rect.top
      if (g.lastDistance > 0) zoomAt(distance / g.lastDistance, midX, midY)
      g.lastDistance = distance
      v.cx -= (e.clientX - previous.x) / 2 / v.k
      v.cy -= (e.clientY - previous.y) / 2 / v.k
      keepInside()
      fitted.current = false
      apply()
      return
    }

    if (!g.dragging && Math.hypot(current.x - g.startX, current.y - g.startY) > DRAG_THRESHOLD_PX) {
      g.dragging = true
      // Keep receiving move events even if the pointer leaves the board while dragging.
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    if (g.dragging) {
      v.cx -= (current.x - previous.x) / v.k
      v.cy -= (current.y - previous.y) / v.k
      keepInside()
      fitted.current = false
      apply()
    }
  }

  const finishPointer = (e: ReactPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    pointers.current.delete(e.pointerId)
    const g = gesture.current
    if (!g) return
    if (pointers.current.size === 0) {
      gesture.current = null
      if (!cancelled && !g.dragging && !g.multi && g.tapTarget) tapHandler.current(g.tapTarget)
    } else if (pointers.current.size === 1) {
      // One finger of a pinch lifted. The remaining finger must not cause a jump or a tap.
      g.lastDistance = 0
    }
  }

  return {
    containerRef,
    svgRef,
    ready,
    zoomIn,
    zoomOut,
    fit,
    ensureVisible,
    onPointerDown,
    onPointerMove,
    onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => finishPointer(e, false),
    onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => finishPointer(e, true),
  }
}
