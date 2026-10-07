import { describe, expect, it } from 'vitest'
import { boundsOf, headOf, makeArrow } from './arrow.ts'

describe('boundsOf', () => {
  it('returns the smallest rectangle that contains every cell of every arrow', () => {
    const a = makeArrow('a', [
      { row: 2, col: 3 },
      { row: 2, col: 4 },
      { row: 3, col: 4 },
    ])
    const b = makeArrow('b', [
      { row: 7, col: 1 },
      { row: 6, col: 1 },
    ])
    expect(boundsOf([a, b])).toEqual({ minRow: 2, maxRow: 7, minCol: 1, maxCol: 4 })
  })
})

describe('headOf', () => {
  it('is the last cell', () => {
    const a = makeArrow('a', [
      { row: 0, col: 0 },
      { row: 0, col: 1 },
    ])
    expect(headOf(a)).toEqual({ row: 0, col: 1 })
  })
})
