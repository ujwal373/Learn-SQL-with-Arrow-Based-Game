import initSqlJs from 'sql.js'
import { describe, expect, it } from 'vitest'
import type { Question } from '../storage/types.ts'
import {
  buildQuery,
  checkAnswer,
  compareResults,
  countBlanks,
  describeSchema,
  hasMultipleStatements,
  openDatabase,
  runSelect,
  splitTemplate,
} from './check.ts'

// In Node, sql.js finds its own wasm file. The browser passes the file location in engine.ts.
const SQL = await initSqlJs()

const SETUP = `
  CREATE TABLE pets (id INTEGER PRIMARY KEY, name TEXT, age INTEGER, weight REAL);
  INSERT INTO pets VALUES (1,'Rex',3,12.5),(2,'Mia',5,4.2),(3,'Bo',3,8.0),(4,'Zed',9,30.1);
`

const base: Question = {
  id: 'T-1',
  tier: 1,
  topic: 'test',
  dataset: 'pets',
  mode: 'blanks',
  prompt: 'Show pets older than 4.',
  template: 'SELECT name FROM pets WHERE age ___ 4',
  answers: ['>'],
  wordBank: [],
  expectedSql: 'SELECT name FROM pets WHERE age > 4',
  orderMatters: false,
  hint: '',
  explanation: '',
}

describe('templates', () => {
  it('splits a template around its blanks and counts them', () => {
    expect(splitTemplate('SELECT ___ FROM ___')).toEqual(['SELECT ', ' FROM ', ''])
    expect(countBlanks('SELECT ___ FROM ___')).toBe(2)
    expect(countBlanks('SELECT 1')).toBe(0)
  })

  it('fills blanks in order', () => {
    const q = { ...base, template: 'SELECT ___ FROM ___ WHERE age ___ 4' }
    expect(buildQuery(q, ['name', 'pets', '>'])).toBe('SELECT name FROM pets WHERE age > 4')
  })

  it('adds a completion after the start of the query', () => {
    const q: Question = { ...base, mode: 'complete', template: 'SELECT name FROM pets ' }
    expect(buildQuery(q, ['WHERE age > 4'])).toBe('SELECT name FROM pets WHERE age > 4')
    expect(buildQuery({ ...q, template: '' }, ['SELECT 1'])).toBe('SELECT 1')
  })
})

describe('hasMultipleStatements', () => {
  it('allows one statement, with or without a final semicolon', () => {
    expect(hasMultipleStatements('SELECT 1')).toBe(false)
    expect(hasMultipleStatements('SELECT 1;')).toBe(false)
    expect(hasMultipleStatements('SELECT 1 ;  \n ')).toBe(false)
  })

  it('rejects a second statement', () => {
    expect(hasMultipleStatements('SELECT 1; SELECT 2')).toBe(true)
    expect(hasMultipleStatements('SELECT 1; DROP TABLE pets')).toBe(true)
  })

  it('ignores semicolons inside quotes and comments', () => {
    expect(hasMultipleStatements("SELECT 'a;b' FROM pets")).toBe(false)
    expect(hasMultipleStatements('SELECT 1 -- done; really')).toBe(false)
    expect(hasMultipleStatements('SELECT 1 /* a; b */')).toBe(false)
  })
})

describe('runSelect', () => {
  const db = openDatabase(SQL, SETUP)

  it('returns column names and rows', () => {
    const out = runSelect(db, 'SELECT name, age FROM pets WHERE age = 3 ORDER BY id')
    expect(out).toEqual({
      ok: true,
      result: {
        columns: ['name', 'age'],
        rows: [
          ['Rex', 3],
          ['Bo', 3],
        ],
      },
    })
  })

  it('still reports the columns when no rows match', () => {
    const out = runSelect(db, 'SELECT name, age FROM pets WHERE age > 100')
    expect(out).toEqual({ ok: true, result: { columns: ['name', 'age'], rows: [] } })
  })

  it('explains mistakes in plain words', () => {
    const missing = runSelect(db, 'SELECT nope FROM pets')
    expect(missing.ok).toBe(false)
    expect(!missing.ok && missing.error).toContain('no such column')

    const syntax = runSelect(db, 'SELEC name FROM pets')
    expect(syntax.ok).toBe(false)

    expect(runSelect(db, '   ')).toEqual({ ok: false, error: 'Write a query first.' })
    expect(runSelect(db, 'SELECT 1; SELECT 2')).toEqual({ ok: false, error: 'Run one statement at a time.' })
  })

  it('does not let a query change the data', () => {
    const out = runSelect(db, "INSERT INTO pets VALUES (9,'Max',1,1.0)")
    expect(out.ok).toBe(false)
    expect(!out.ok && out.error).toContain('Only SELECT')
    expect(runSelect(db, 'SELECT COUNT(*) FROM pets')).toEqual({
      ok: true,
      result: { columns: ['COUNT(*)'], rows: [[4]] },
    })
  })
})

describe('describeSchema', () => {
  it('lists tables and their columns', () => {
    expect(describeSchema(openDatabase(SQL, SETUP))).toEqual([
      { name: 'pets', columns: ['id', 'name', 'age', 'weight'] },
    ])
  })
})

describe('compareResults', () => {
  const result = (rows: (number | string | null)[][], columns = ['a']) => ({ columns, rows })

  it('accepts identical results', () => {
    expect(compareResults(result([[1], [2]]), result([[1], [2]]), false).match).toBe(true)
  })

  it('ignores row order unless the order matters', () => {
    const a = result([[2], [1]])
    const b = result([[1], [2]])
    expect(compareResults(a, b, false).match).toBe(true)
    const ordered = compareResults(a, b, true)
    expect(ordered.match).toBe(false)
    expect(ordered.message).toContain('wrong order')
  })

  it('ignores column names but not the number of columns', () => {
    expect(compareResults(result([[1]], ['x']), result([[1]], ['y']), false).match).toBe(true)
    const wide = compareResults(result([[1, 2]], ['a', 'b']), result([[1]]), false)
    expect(wide.match).toBe(false)
    expect(wide.message).toContain('2 columns')
  })

  it('counts rows, including duplicates', () => {
    const out = compareResults(result([[1]]), result([[1], [1]]), false)
    expect(out.match).toBe(false)
    expect(out.message).toContain('1 row')
    expect(compareResults(result([[1], [1], [2]]), result([[1], [2], [2]]), false).match).toBe(false)
  })

  it('treats 2 and 2.0 as equal and ignores tiny rounding differences', () => {
    expect(compareResults(result([[2]]), result([[2.0000000001]]), false).match).toBe(true)
    expect(compareResults(result([[2]]), result([[2.01]]), false).match).toBe(false)
  })

  it('tells NULL apart from empty text and zero', () => {
    expect(compareResults(result([[null]]), result([['']]), false).match).toBe(false)
    expect(compareResults(result([[null]]), result([[0]]), false).match).toBe(false)
  })
})

describe('checkAnswer', () => {
  it('accepts any query that returns the right rows', () => {
    expect(checkAnswer(SQL, SETUP, base, 'SELECT name FROM pets WHERE age > 4').correct).toBe(true)
    // A different way of writing it.
    expect(checkAnswer(SQL, SETUP, base, 'select name from pets where age >= 5').correct).toBe(true)
    expect(checkAnswer(SQL, SETUP, base, 'SELECT p.name AS n FROM pets p WHERE NOT age <= 4;').correct).toBe(true)
  })

  it('rejects a query with the wrong rows and says why', () => {
    const out = checkAnswer(SQL, SETUP, base, 'SELECT name FROM pets WHERE age > 5')
    expect(out.correct).toBe(false)
    expect(out.message).toContain('1 row')
    expect(out.playerResult?.rows).toHaveLength(1)
    expect(out.expectedResult.rows).toEqual([['Mia'], ['Zed']])
  })

  it('reports a query that fails to run', () => {
    const out = checkAnswer(SQL, SETUP, base, 'SELECT name FROM cats')
    expect(out.correct).toBe(false)
    expect(out.message).toContain('no such table')
    expect(out.playerResult).toBeNull()
  })

  it('throws when the answer query of a question is itself broken', () => {
    const broken = { ...base, expectedSql: 'SELECT oops FROM pets' }
    expect(() => checkAnswer(SQL, SETUP, broken, 'SELECT 1')).toThrow('invalid answer query')
  })

  it('checks row order only for questions that need it', () => {
    const ordered: Question = {
      ...base,
      expectedSql: 'SELECT name FROM pets ORDER BY age DESC, id',
      orderMatters: true,
    }
    expect(checkAnswer(SQL, SETUP, ordered, 'SELECT name FROM pets ORDER BY age DESC, id').correct).toBe(true)
    expect(checkAnswer(SQL, SETUP, ordered, 'SELECT name FROM pets ORDER BY age, id').correct).toBe(false)
  })
})
