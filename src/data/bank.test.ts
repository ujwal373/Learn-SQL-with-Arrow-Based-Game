import initSqlJs from 'sql.js'
import { describe, expect, it } from 'vitest'
import { buildQuery, checkAnswer, countBlanks } from '../sql/check.ts'
import type { Question } from '../storage/types.ts'
import questionsJson from './fallback/questions.json'

// These tests protect the question bank. Every question must have an answer that works, a word bank
// that contains the answer, and wrong choices that really are wrong. Run them after editing the bank.

const SQL = await initSqlJs()
const questions = questionsJson as Question[]

const files = import.meta.glob('./fallback/datasets/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const datasets: Record<string, string> = {}
for (const [path, sql] of Object.entries(files)) {
  const name = path.split('/').pop()!.replace(/\.sql$/, '')
  datasets[name] = sql
}

describe('question bank', () => {
  it('has unique ids and known datasets', () => {
    const ids = new Set(questions.map((q) => q.id))
    expect(ids.size).toBe(questions.length)
    for (const q of questions) expect(datasets[q.dataset], `${q.id} dataset`).toBeDefined()
  })

  it('covers tiers 1 to 9 with the same number of questions each', () => {
    for (let tier = 1; tier <= 9; tier++) {
      expect(questions.filter((q) => q.tier === tier).length, `tier ${tier}`).toBe(8)
    }
  })

  for (const q of questions) {
    describe(q.id, () => {
      const setup = datasets[q.dataset]

      it('has a consistent shape', () => {
        expect(q.prompt.length).toBeGreaterThan(0)
        expect(q.hint.length).toBeGreaterThan(0)
        expect(q.explanation.length).toBeGreaterThan(0)
        if (q.mode === 'blanks') {
          expect(countBlanks(q.template)).toBe(q.answers.length)
          for (const a of q.answers) expect(q.wordBank).toContain(a)
          expect(new Set(q.wordBank).size).toBe(q.wordBank.length)
        } else {
          expect(countBlanks(q.template)).toBe(0)
          expect(q.answers).toHaveLength(1)
        }
      })

      it('accepts its own answer', () => {
        const query = buildQuery(q, q.answers)
        const out = checkAnswer(SQL, setup, q, query)
        expect(out.correct, `${query} -> ${out.message}`).toBe(true)
      })

      if (q.mode === 'blanks') {
        it('rejects every wrong word bank choice', () => {
          const wrong = q.wordBank.filter((w) => !q.answers.includes(w))
          for (let blank = 0; blank < q.answers.length; blank++) {
            for (const choice of wrong) {
              const inputs = [...q.answers]
              inputs[blank] = choice
              const query = buildQuery(q, inputs)
              const out = checkAnswer(SQL, setup, q, query)
              expect(out.correct, `distractor "${choice}" gives a correct answer: ${query}`).toBe(false)
            }
          }
        })
      }
    })
  }
})
