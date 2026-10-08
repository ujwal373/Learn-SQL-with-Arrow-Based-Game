import { describe, expect, it } from 'vitest'
import type { Question } from '../storage/types.ts'
import { QuestionDeck, tierForLevel, usesWordBank } from './curriculum.ts'

function make(id: string, tier: number, over: Partial<Question> = {}): Question {
  return {
    id,
    tier,
    topic: 't',
    dataset: 'school',
    mode: 'blanks',
    prompt: 'p',
    template: 'SELECT ___',
    answers: ['1'],
    wordBank: ['1', '2'],
    expectedSql: 'SELECT 1',
    orderMatters: false,
    hint: 'h',
    explanation: 'e',
    ...over,
  }
}

// Three tiers with eight questions each.
const bank: Question[] = [1, 2, 3].flatMap((t) => Array.from({ length: 8 }, (_, i) => make(`t${t}-${i}`, t)))

describe('tierForLevel', () => {
  it('moves up one tier every two levels and stops at the top', () => {
    expect([1, 2, 3, 4, 5].map(tierForLevel)).toEqual([1, 1, 2, 2, 3])
    expect(tierForLevel(17)).toBe(9)
    expect(tierForLevel(18)).toBe(9)
    expect(tierForLevel(500)).toBe(9)
  })

  it('treats odd input as level 1', () => {
    expect(tierForLevel(0)).toBe(1)
    expect(tierForLevel(-4)).toBe(1)
  })
})

describe('usesWordBank', () => {
  it('offers the bank on early levels only', () => {
    expect(usesWordBank(1, make('a', 1))).toBe(true)
    expect(usesWordBank(8, make('a', 1))).toBe(true)
    expect(usesWordBank(9, make('a', 1))).toBe(false)
  })

  it('never offers it for complete questions or questions without words', () => {
    expect(usesWordBank(1, make('a', 1, { mode: 'complete' }))).toBe(false)
    expect(usesWordBank(1, make('a', 1, { wordBank: [] }))).toBe(false)
  })
})

describe('QuestionDeck', () => {
  it('only asks the own tier on level 1', () => {
    const deck = new QuestionDeck(bank, 1, 7)
    for (let i = 0; i < 30; i++) expect(deck.next().tier).toBe(1)
  })

  it('does not repeat a question until its round of eight is done', () => {
    const deck = new QuestionDeck(bank, 1, 7)
    const ids = Array.from({ length: 8 }, () => deck.next().id)
    expect(new Set(ids).size).toBe(8)
  })

  it('mixes in review questions from earlier tiers', () => {
    // Level 5 is tier 3. A round holds 8 own questions, 4 from tier 2 and 4 from tier 1.
    const deck = new QuestionDeck(bank, 5, 3)
    const round = Array.from({ length: 16 }, () => deck.next())
    expect(round.filter((q) => q.tier === 3)).toHaveLength(8)
    expect(round.filter((q) => q.tier === 2)).toHaveLength(4)
    expect(round.filter((q) => q.tier === 1)).toHaveLength(4)
    expect(new Set(round.map((q) => q.id)).size).toBe(16)
  })

  it('never gives the same question twice in a row, even between rounds', () => {
    const deck = new QuestionDeck(bank, 3, 11)
    let previous = ''
    for (let i = 0; i < 200; i++) {
      const id = deck.next().id
      expect(id).not.toBe(previous)
      previous = id
    }
  })

  it('repeats the same sequence for the same seed', () => {
    const a = new QuestionDeck(bank, 5, 99)
    const b = new QuestionDeck(bank, 5, 99)
    expect(Array.from({ length: 20 }, () => a.next().id)).toEqual(Array.from({ length: 20 }, () => b.next().id))
  })

  it('falls back to the whole bank when a tier has no questions', () => {
    const deck = new QuestionDeck(bank, 15, 1)
    expect(deck.next()).toBeDefined()
  })
})
