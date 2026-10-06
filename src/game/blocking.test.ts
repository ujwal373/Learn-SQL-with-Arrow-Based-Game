import { describe, expect, it } from 'vitest'
import { canClearAll, getBlocker, isBlocked } from './blocking.ts'
import type { Arrow, Direction } from './types.ts'

const arrow = (id: string, row: number, col: number, dir: Direction): Arrow => ({
  id,
  row,
  col,
  dir,
})

describe('getBlocker', () => {
  it('returns null when the path to the edge is empty', () => {
    const a = arrow('a', 2, 2, 'right')
    expect(getBlocker(a, [a], 5, 5)).toBeNull()
  })

  it('returns the arrow standing in the way', () => {
    const a = arrow('a', 1, 0, 'right')
    const b = arrow('b', 1, 3, 'up')
    expect(getBlocker(a, [a, b], 5, 5)?.id).toBe('b')
  })

  it('returns the nearest arrow when several are in the path', () => {
    const a = arrow('a', 0, 0, 'down')
    const near = arrow('near', 2, 0, 'left')
    const far = arrow('far', 4, 0, 'left')
    expect(getBlocker(a, [a, far, near], 5, 5)?.id).toBe('near')
  })

  it('ignores arrows behind it or in other rows and columns', () => {
    const a = arrow('a', 2, 2, 'up')
    const behind = arrow('behind', 3, 2, 'up')
    const beside = arrow('beside', 1, 3, 'up')
    expect(getBlocker(a, [a, behind, beside], 5, 5)).toBeNull()
  })

  it('an arrow on the edge pointing outward is always free', () => {
    const a = arrow('a', 0, 2, 'up')
    const other = arrow('other', 1, 2, 'up')
    expect(isBlocked(a, [a, other], 5, 5)).toBe(false)
  })

  it('only counts the arrows it is given, so cleared arrows stop blocking', () => {
    const a = arrow('a', 0, 0, 'right')
    const b = arrow('b', 0, 2, 'down')
    expect(isBlocked(a, [a, b], 4, 4)).toBe(true)
    expect(isBlocked(a, [a], 4, 4)).toBe(false)
  })
})

describe('canClearAll', () => {
  it('clears a chain where each arrow unblocks the next', () => {
    const arrows = [arrow('a', 0, 0, 'right'), arrow('b', 0, 2, 'right')]
    expect(canClearAll(arrows, 3, 3)).toBe(true)
  })

  it('detects a deadlock where two arrows point at each other', () => {
    const arrows = [arrow('a', 0, 0, 'right'), arrow('b', 0, 2, 'left')]
    expect(canClearAll(arrows, 3, 3)).toBe(false)
  })
})
