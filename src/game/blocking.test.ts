import { describe, expect, it } from 'vitest'
import { makeArrow } from './arrow.ts'
import { analyzeBoard, canClearAll, findHintArrow, getBlocker, isBlocked } from './blocking.ts'
import { getExitInfo } from './exit.ts'
import type { Arrow } from './types.ts'

// Shorthand: arrow('a', [0, 0], [0, 1], [0, 2]) is a snake from tail (0,0) to head (0,2).
const arrow = (id: string, ...cells: [number, number][]): Arrow =>
  makeArrow(
    id,
    cells.map(([row, col]) => ({ row, col })),
  )

describe('makeArrow', () => {
  it('takes the direction from the last segment, so bent snakes point the way their head faces', () => {
    expect(arrow('a', [2, 0], [2, 1], [1, 1]).dir).toBe('up')
    expect(arrow('b', [0, 0], [1, 0], [1, 1], [1, 2]).dir).toBe('right')
  })

  it('rejects diagonal jumps and one cell arrows', () => {
    expect(() => arrow('a', [0, 0], [1, 1])).toThrow()
    expect(() => arrow('b', [0, 0])).toThrow()
  })
})

describe('getBlocker', () => {
  it('returns null when the path from the head to the edge is empty', () => {
    const a = arrow('a', [2, 1], [2, 2])
    expect(getBlocker(a, [a], 5, 5)).toBeNull()
  })

  it('returns the arrow standing in the way of the head', () => {
    const a = arrow('a', [1, 0], [1, 1])
    const b = arrow('b', [0, 3], [1, 3])
    expect(getBlocker(a, [a, b], 5, 5)?.id).toBe('b')
  })

  it('returns the nearest arrow when several are in the path', () => {
    const a = arrow('a', [0, 0], [1, 0])
    const near = arrow('near', [3, 0], [3, 1])
    const far = arrow('far', [4, 0], [4, 1])
    expect(getBlocker(a, [a, far, near], 6, 5)?.id).toBe('near')
  })

  it('only looks ahead of the head, not behind it or at the tail', () => {
    // Head at (2,2) pointing up. The tail trails below it and another arrow sits behind the tail.
    const a = arrow('a', [3, 2], [2, 2])
    const behind = arrow('behind', [4, 2], [4, 3])
    const beside = arrow('beside', [1, 3], [0, 3])
    expect(getBlocker(a, [a, behind, beside], 6, 6)).toBeNull()
  })

  it('treats any cell of a long snake as blocking, not just its head', () => {
    const a = arrow('a', [2, 0], [2, 1])
    // A long vertical snake crossing row 2 further right.
    const wall = arrow('wall', [0, 4], [1, 4], [2, 4], [3, 4])
    expect(getBlocker(a, [a, wall], 5, 6)?.id).toBe('wall')
  })

  it('reports an arrow that points at its own body as blocked by itself', () => {
    // The head at (0,2) arrives from (0,3), so it points left and runs into its own tail at (0,0).
    const a = arrow('a', [0, 0], [1, 0], [1, 1], [1, 2], [1, 3], [0, 3], [0, 2])
    expect(getBlocker(a, [a], 4, 5)?.id).toBe('a')
  })

  it('only counts the arrows it is given, so cleared arrows stop blocking', () => {
    const a = arrow('a', [0, 0], [0, 1])
    const b = arrow('b', [0, 3], [1, 3])
    expect(isBlocked(a, [a, b], 4, 5)).toBe(true)
    expect(isBlocked(a, [a], 4, 5)).toBe(false)
  })
})

describe('analyzeBoard and canClearAll', () => {
  it('clears a chain where each arrow unblocks the next', () => {
    const arrows = [arrow('a', [0, 0], [0, 1]), arrow('b', [0, 3], [0, 4])]
    expect(canClearAll(arrows, 3, 6)).toBe(true)
    expect(analyzeBoard(arrows, 3, 6).freeCount).toBe(1)
  })

  it('detects a deadlock where two arrows point at each other', () => {
    const arrows = [arrow('a', [0, 0], [0, 1]), arrow('b', [0, 4], [0, 3])]
    const result = analyzeBoard(arrows, 3, 6)
    expect(result.stuck).toEqual([0, 1])
    expect(result.freeCount).toBe(0)
  })

  it('reports arrows that wait on a deadlock as stuck too', () => {
    const a = arrow('a', [0, 0], [0, 1])
    const b = arrow('b', [0, 4], [0, 3])
    // c points up into row 0 between a and b? It points at a's row only if it lines up, so aim it at b.
    const c = arrow('c', [3, 3], [2, 3])
    expect(analyzeBoard([a, b, c], 4, 6).stuck).toEqual([0, 1, 2])
  })

  it('is not solvable when an arrow points at its own body', () => {
    const a = arrow('a', [0, 0], [1, 0], [1, 1], [1, 2], [1, 3], [0, 3], [0, 2])
    expect(canClearAll([a], 4, 5)).toBe(false)
  })
})

describe('findHintArrow', () => {
  it('returns a free arrow', () => {
    const a = arrow('a', [0, 0], [0, 1])
    const b = arrow('b', [0, 3], [1, 3])
    const hint = findHintArrow([a, b], 4, 5)
    expect(hint?.id).toBe('b')
    expect(isBlocked(hint!, [a, b], 4, 5)).toBe(false)
  })

  it('prefers the free arrow that unblocks the most others', () => {
    // "loner" is free but stands in nobody's way. "wide" is free and stands in the way of three arrows.
    const loner = arrow('loner', [6, 0], [6, 1]) // points right along an empty row
    const wide = arrow('wide', [2, 5], [1, 5]) // points up, nothing above it
    const narrow = arrow('narrow', [5, 5], [4, 5]) // points up, blocked by wide at (2,5)
    const left1 = arrow('left1', [1, 0], [1, 1]) // points right, blocked by wide at (1,5)
    const left2 = arrow('left2', [2, 0], [2, 1]) // points right, blocked by wide at (2,5)
    const all = [loner, wide, narrow, left1, left2]

    expect(isBlocked(loner, all, 7, 7)).toBe(false)
    expect(isBlocked(wide, all, 7, 7)).toBe(false)
    expect(findHintArrow(all, 7, 7)?.id).toBe('wide')
  })

  it('returns null when nothing is left', () => {
    expect(findHintArrow([], 5, 5)).toBeNull()
  })
})

describe('getExitInfo', () => {
  it('slides the body length plus the open cells ahead of the head, plus a margin', () => {
    // Body of 2 cells of line, head at column 1 of a 6 column board, pointing right: 4 cells ahead.
    const a = arrow('a', [2, 0], [2, 1])
    const info = getExitInfo(a, 5, 6)
    expect(info.bodyLength).toBe(1)
    expect(info.slide).toBe(1 + 4 + 1)
    expect(info.dx).toBe(1)
    expect(info.dy).toBe(0)
  })

  it('keeps animation time within its limits', () => {
    const a = arrow('a', [0, 0], [0, 1])
    const { durationMs } = getExitInfo(a, 4, 200)
    expect(durationMs).toBeLessThanOrEqual(1100)
    expect(durationMs).toBeGreaterThanOrEqual(350)
  })
})
