import type { Database, SqlJsStatic, SqlValue } from 'sql.js'
import type { Question } from '../storage/types.ts'

// Checks a player's SQL by running it, not by comparing text. The player's query and the answer
// query both run on the same small dataset, and the answer is correct when the rows match. So any
// correct way of writing the query is accepted, for example BETWEEN or two comparisons.

export const BLANK = '___'

// Safety nets for the browser: no query may return an enormous result.
const MAX_ROWS = 5000

export interface QueryResult {
  columns: string[]
  rows: SqlValue[][]
}

export type RunOutcome = { ok: true; result: QueryResult } | { ok: false; error: string }

export interface CheckOutcome {
  correct: boolean
  // Plain language feedback. For a correct answer it is empty.
  message: string
  // What the player's query returned, or null if it failed to run.
  playerResult: QueryResult | null
  expectedResult: QueryResult
}

export interface SchemaTable {
  name: string
  columns: string[]
}

// Building the query from a question

// Splits a template into the text around its blanks. "a ___ b ___" becomes ["a ", " b ", ""].
export function splitTemplate(template: string): string[] {
  return template.split(BLANK)
}

export function countBlanks(template: string): number {
  return splitTemplate(template).length - 1
}

// Joins the player's input into one query.
//   blanks:   every blank in the template is replaced by the matching input, in order.
//   complete: the input is added after the template.
export function buildQuery(question: Question, inputs: string[]): string {
  if (question.mode === 'complete') {
    return `${question.template.trimEnd()} ${(inputs[0] ?? '').trim()}`.trim()
  }
  const parts = splitTemplate(question.template)
  let query = parts[0]
  for (let i = 1; i < parts.length; i++) {
    query += `${(inputs[i - 1] ?? '').trim()}${parts[i]}`
  }
  return query
}

// Running queries

function readError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error)
  return text.replace(/^Error:\s*/, '')
}

// True if the text holds more than one statement. Semicolons inside quotes or comments do not count,
// and neither does a final semicolon.
export function hasMultipleStatements(sql: string): boolean {
  let quote: string | null = null
  let lineComment = false
  let blockComment = false
  let seenSemicolon = false

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]
    const next = sql[i + 1]

    if (lineComment) {
      if (ch === '\n') lineComment = false
    } else if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false
        i++
      }
    } else if (quote !== null) {
      if (ch === quote) quote = null
    } else if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch
    } else if (ch === '-' && next === '-') {
      lineComment = true
    } else if (ch === '/' && next === '*') {
      blockComment = true
    } else if (ch === ';') {
      seenSemicolon = true
    } else if (seenSemicolon && !/\s/.test(ch)) {
      return true
    }
  }
  return false
}

// Opens a fresh in-memory database filled by the dataset's setup SQL. Writes are switched off after
// the setup, so a query can only read.
export function openDatabase(SQL: SqlJsStatic, setupSql: string): Database {
  const db = new SQL.Database()
  db.run(setupSql)
  db.run('PRAGMA query_only = ON')
  return db
}

export function runSelect(db: Database, sql: string): RunOutcome {
  const text = sql.trim()
  if (text === '' || text === ';') return { ok: false, error: 'Write a query first.' }
  if (hasMultipleStatements(text)) return { ok: false, error: 'Run one statement at a time.' }

  let statement
  try {
    // A prepared statement, rather than db.exec, so the column names are known even when the
    // query returns no rows.
    statement = db.prepare(text)
  } catch (error) {
    return { ok: false, error: readError(error) }
  }

  try {
    const columns = statement.getColumnNames()
    const rows: SqlValue[][] = []
    while (statement.step()) {
      rows.push(statement.get())
      if (rows.length > MAX_ROWS) return { ok: false, error: 'Your query returned too many rows.' }
    }
    return { ok: true, result: { columns, rows } }
  } catch (error) {
    const message = readError(error)
    if (/readonly/i.test(message)) {
      return { ok: false, error: 'Only SELECT queries are allowed here. You cannot change the data.' }
    }
    return { ok: false, error: message }
  } finally {
    statement.free()
  }
}

// Describes the tables of a database, to show the player what they can query.
export function describeSchema(db: Database): SchemaTable[] {
  const names = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid")
  if (names.length === 0) return []
  return names[0].values.map(([name]) => {
    const info = db.exec(`PRAGMA table_info("${String(name)}")`)
    const columns = info.length === 0 ? [] : info[0].values.map((row) => String(row[1]))
    return { name: String(name), columns }
  })
}

// Comparing results

function normalise(value: SqlValue): string {
  if (value === null) return 'null'
  if (typeof value === 'number') {
    // Averages and sums of decimals can differ in the last digits. Six decimals is plenty.
    return `n:${Math.round(value * 1e6) / 1e6}`
  }
  if (typeof value === 'string') return `s:${value}`
  return `b:${Array.from(value).join(',')}`
}

const rowKey = (row: SqlValue[]) => row.map(normalise).join('|')

export function compareResults(
  actual: QueryResult,
  expected: QueryResult,
  orderMatters: boolean,
): { match: boolean; message: string } {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

  if (actual.columns.length !== expected.columns.length) {
    return {
      match: false,
      message: `Your query returned ${plural(actual.columns.length, 'column')}, but the answer has ${expected.columns.length}.`,
    }
  }
  if (actual.rows.length !== expected.rows.length) {
    return {
      match: false,
      message: `Your query returned ${plural(actual.rows.length, 'row')}, but the answer has ${expected.rows.length}.`,
    }
  }

  const actualKeys = actual.rows.map(rowKey)
  const expectedKeys = expected.rows.map(rowKey)
  const sameInOrder = actualKeys.every((key, i) => key === expectedKeys[i])
  if (sameInOrder) return { match: true, message: '' }

  const sameRows = [...actualKeys].sort().join('\n') === [...expectedKeys].sort().join('\n')
  if (sameRows) {
    if (orderMatters) return { match: false, message: 'The rows are right, but they are in the wrong order.' }
    return { match: true, message: '' }
  }
  return { match: false, message: 'The rows your query returned are not the ones the task asks for.' }
}

// Checks one answer. A fresh database is built each time, so one attempt can never affect another.
export function checkAnswer(
  SQL: SqlJsStatic,
  setupSql: string,
  question: Question,
  playerSql: string,
): CheckOutcome {
  const db = openDatabase(SQL, setupSql)
  try {
    const expected = runSelect(db, question.expectedSql)
    if (!expected.ok) {
      // A broken question is a bug in the question bank, not something the player did.
      throw new Error(`Question ${question.id} has an invalid answer query: ${expected.error}`)
    }

    const player = runSelect(db, playerSql)
    if (!player.ok) {
      return { correct: false, message: player.error, playerResult: null, expectedResult: expected.result }
    }

    const { match, message } = compareResults(player.result, expected.result, question.orderMatters)
    return { correct: match, message, playerResult: player.result, expectedResult: expected.result }
  } finally {
    db.close()
  }
}
