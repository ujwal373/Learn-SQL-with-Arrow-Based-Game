import type { Question } from '../storage/types.ts'
import { mulberry32 } from './rng.ts'

// The curriculum decides which SQL the player meets at which level.
//
// Tiers, from easiest to hardest:
//   1 SELECT and FROM          4 LIKE, IN, BETWEEN, NULL   7 JOINs
//   2 WHERE                    5 Aggregate functions       8 Subqueries, CASE, WITH
//   3 ORDER BY, LIMIT, DISTINCT  6 GROUP BY and HAVING     9 Window functions
//
// Every two levels the player moves up one tier. A level mostly asks questions from its own tier,
// mixed with a few reviews of the two tiers before it, so old skills are not forgotten.

export const MAX_TIER = 9
export const LEVELS_PER_TIER = 2

// Up to and including this level, blanks questions offer a word bank to tap. After it the player types.
export const WORD_BANK_LAST_LEVEL = 8

// How many questions of each earlier tier join a round of the deck (see QuestionDeck).
const REVIEW_PER_TIER = 4
const REVIEW_TIERS = 2

export function tierForLevel(level: number): number {
  const lvl = Math.max(1, Math.floor(level))
  return Math.min(MAX_TIER, Math.ceil(lvl / LEVELS_PER_TIER))
}

// True when the player should pick words instead of typing.
export function usesWordBank(level: number, question: Question): boolean {
  return question.mode === 'blanks' && question.wordBank.length > 0 && level <= WORD_BANK_LAST_LEVEL
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// Hands out questions for one level, one by one. A round contains every question of the level's own
// tier plus a few from the two tiers before it, in random order. A question is not repeated until its
// round is finished, and a new round never starts with the question that ended the last one.
// The seed makes a level's sequence repeatable, which keeps tests and bug reports simple.
export class QuestionDeck {
  private readonly own: Question[]
  private readonly earlier: Question[][]
  private readonly random: () => number
  private queue: Question[] = []
  private last: Question | null = null

  constructor(questions: Question[], level: number, seed: number) {
    const tier = tierForLevel(level)
    this.random = mulberry32(seed)
    this.own = questions.filter((q) => q.tier === tier)
    this.earlier = []
    for (let t = tier - 1; t >= Math.max(1, tier - REVIEW_TIERS); t--) {
      this.earlier.push(questions.filter((q) => q.tier === t))
    }
    if (this.own.length === 0) {
      // A bank without this tier should never crash the game. Fall back to the whole bank.
      this.own = questions
    }
  }

  private refill() {
    const round = [...this.own]
    for (const group of this.earlier) {
      round.push(...shuffle(group, this.random).slice(0, REVIEW_PER_TIER))
    }
    this.queue = shuffle(round, this.random)
    // Avoid the same question twice in a row across two rounds.
    if (this.queue.length > 1 && this.queue[0].id === this.last?.id) {
      this.queue.push(this.queue.shift()!)
    }
  }

  next(): Question {
    if (this.queue.length === 0) this.refill()
    const question = this.queue.shift()!
    this.last = question
    return question
  }
}
