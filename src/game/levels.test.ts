import { describe, expect, it } from 'vitest'
import { analyzeBoard, canClearAll } from './blocking.ts'
import { generateBoard, getLevelConfig } from './levels.ts'

const LEVELS = Array.from({ length: 45 }, (_, i) => i + 1)

describe('getLevelConfig', () => {
  it('starts with a small pattern and grows the grid with the level', () => {
    expect(getLevelConfig(1).rows).toBe(12)
    let previous = 0
    for (const level of LEVELS) {
      const { rows } = getLevelConfig(level)
      expect(rows).toBeGreaterThanOrEqual(previous)
      previous = rows
    }
    expect(getLevelConfig(30).rows).toBeGreaterThan(getLevelConfig(5).rows * 2)
    expect(getLevelConfig(1).cellTarget).toBe(4)
  })

  it('raises the number of pattern cells every level, whatever the shape', () => {
    for (let level = 1; level < 38; level++) {
      expect(getLevelConfig(level + 1).cellTarget).toBeGreaterThan(getLevelConfig(level).cellTarget)
    }
  })

  it('stops growing at a maximum so the board stays playable', () => {
    expect(getLevelConfig(500).rows).toBe(getLevelConfig(50).rows)
  })

  it('makes snakes longer as levels rise', () => {
    expect(getLevelConfig(40).maxLen).toBeGreaterThan(getLevelConfig(1).maxLen)
  })
})

describe('generateBoard', () => {
  it('puts every arrow inside the grid with no overlapping cells', () => {
    for (const level of LEVELS) {
      const { rows, cols, arrows } = generateBoard(level)
      const seen = new Set<string>()
      for (const arrow of arrows) {
        for (const cell of arrow.cells) {
          expect(cell.row).toBeGreaterThanOrEqual(0)
          expect(cell.row).toBeLessThan(rows)
          expect(cell.col).toBeGreaterThanOrEqual(0)
          expect(cell.col).toBeLessThan(cols)
          const key = `${cell.row},${cell.col}`
          expect(seen.has(key)).toBe(false)
          seen.add(key)
        }
      }
      expect(new Set(arrows.map((a) => a.id)).size).toBe(arrows.length)
    }
  })

  it('builds snakes of at least two cells whose cells are connected in a row', () => {
    for (const level of [1, 7, 20, 40]) {
      for (const arrow of generateBoard(level).arrows) {
        expect(arrow.cells.length).toBeGreaterThanOrEqual(2)
        for (let i = 1; i < arrow.cells.length; i++) {
          const gap =
            Math.abs(arrow.cells[i].row - arrow.cells[i - 1].row) +
            Math.abs(arrow.cells[i].col - arrow.cells[i - 1].col)
          expect(gap).toBe(1)
        }
      }
    }
  })

  it('is always solvable', () => {
    for (const level of LEVELS) {
      const { rows, cols, arrows } = generateBoard(level)
      expect(canClearAll(arrows, rows, cols)).toBe(true)
    }
  })

  it('is symmetrical left to right and top to bottom', () => {
    for (const level of LEVELS) {
      const { rows, cols, arrows } = generateBoard(level)
      const cells = new Set(arrows.flatMap((a) => a.cells.map((c) => `${c.row},${c.col}`)))
      for (const key of cells) {
        const [r, c] = key.split(',').map(Number)
        expect(cells.has(`${r},${cols - 1 - c}`)).toBe(true)
        expect(cells.has(`${rows - 1 - r},${c}`)).toBe(true)
      }
      expect(arrows.length % 4).toBe(0)
    }
  })

  it('leaves empty dot grid around the pattern', () => {
    for (const level of [3, 12, 30]) {
      const { margin } = getLevelConfig(level)
      const { rows, cols, arrows } = generateBoard(level)
      const used = arrows.flatMap((a) => a.cells)
      expect(margin).toBeGreaterThanOrEqual(3)
      expect(Math.min(...used.map((c) => c.row))).toBeGreaterThanOrEqual(margin)
      expect(Math.max(...used.map((c) => c.row))).toBeLessThanOrEqual(rows - 1 - margin)
      expect(Math.min(...used.map((c) => c.col))).toBeGreaterThanOrEqual(margin)
      expect(Math.max(...used.map((c) => c.col))).toBeLessThanOrEqual(cols - 1 - margin)
    }
  })

  it('has arrows ready to tap and, from level 2 on, arrows that are blocked', () => {
    for (const level of LEVELS) {
      const { rows, cols, arrows } = generateBoard(level)
      const { freeCount } = analyzeBoard(arrows, rows, cols)
      expect(freeCount).toBeGreaterThanOrEqual(1)
      if (level >= 2) expect(freeCount).toBeLessThan(arrows.length)
    }
  })

  it('adds more arrows as the level rises', () => {
    const count = (level: number) => generateBoard(level).arrows.length
    expect(count(1)).toBe(8)
    // Compared four levels apart, because a single step can wobble a little with the random tiling.
    for (let first = 1; first <= 4; first++) {
      for (let level = first; level + 4 <= 32; level += 4) {
        expect(count(level + 4)).toBeGreaterThan(count(level))
      }
    }
  })

  it('gives the same board for the same level', () => {
    expect(generateBoard(7)).toEqual(generateBoard(7))
  })

  it('generates the largest boards quickly', () => {
    const start = performance.now()
    generateBoard(45)
    generateBoard(100)
    expect(performance.now() - start).toBeLessThan(1500)
  })
})
