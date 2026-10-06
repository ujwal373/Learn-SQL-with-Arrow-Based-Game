import { describe, expect, it } from 'vitest'
import { canClearAll, isBlocked } from './blocking.ts'
import { generateBoard, getLevelConfig } from './levels.ts'

const LEVELS = Array.from({ length: 40 }, (_, i) => i + 1)

describe('getLevelConfig', () => {
  it('matches the arrow counts in the level design draft', () => {
    const counts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((l) => getLevelConfig(l).arrowCount)
    expect(counts).toEqual([4, 5, 6, 6, 7, 9, 9, 10, 12, 12, 13])
  })

  it('grows the grid with each tier', () => {
    expect(getLevelConfig(1).rows).toBe(5)
    expect(getLevelConfig(4).rows).toBe(6)
    expect(getLevelConfig(7).rows).toBe(7)
    expect(getLevelConfig(10).rows).toBe(8)
  })

  it('caps the arrow count so the board is never more than half full', () => {
    const config = getLevelConfig(500)
    expect(config.arrowCount).toBeLessThanOrEqual((config.rows * config.cols) / 2)
  })
})

describe('generateBoard', () => {
  it('produces the configured number of arrows inside the grid on unique cells', () => {
    for (const level of LEVELS) {
      const config = getLevelConfig(level)
      const board = generateBoard(level)
      expect(board.arrows).toHaveLength(config.arrowCount)

      const cells = new Set(board.arrows.map((a) => `${a.row},${a.col}`))
      expect(cells.size).toBe(board.arrows.length)

      const ids = new Set(board.arrows.map((a) => a.id))
      expect(ids.size).toBe(board.arrows.length)

      for (const a of board.arrows) {
        expect(a.row).toBeGreaterThanOrEqual(0)
        expect(a.row).toBeLessThan(board.rows)
        expect(a.col).toBeGreaterThanOrEqual(0)
        expect(a.col).toBeLessThan(board.cols)
      }
    }
  })

  it('is always solvable', () => {
    for (const level of LEVELS) {
      const board = generateBoard(level)
      expect(canClearAll(board.arrows, board.rows, board.cols)).toBe(true)
    }
  })

  it('always has at least one arrow ready to tap and at least one blocked arrow', () => {
    for (const level of LEVELS) {
      const { arrows, rows, cols } = generateBoard(level)
      const blocked = arrows.filter((a) => isBlocked(a, arrows, rows, cols)).length
      expect(blocked).toBeGreaterThanOrEqual(1)
      expect(blocked).toBeLessThan(arrows.length)
    }
  })

  it('gives the same board for the same level', () => {
    expect(generateBoard(7)).toEqual(generateBoard(7))
  })
})
