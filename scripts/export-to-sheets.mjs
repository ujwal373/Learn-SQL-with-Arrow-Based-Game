/**
 * One-time utility: reads the bundled question bank and datasets, then writes two CSV files
 * that you can import directly into Google Sheets.
 *
 *   node scripts/export-to-sheets.mjs
 *
 * Output:
 *   questions.csv  — import into the "questions" tab of your spreadsheet
 *   datasets.csv   — import into the "datasets" tab of your spreadsheet
 *
 * Google Sheets import steps:
 *   1. Open your spreadsheet and select the target tab.
 *   2. File > Import > Upload, choose the CSV file.
 *   3. Select "Replace current sheet", separator "Comma", uncheck "Convert text to numbers".
 *   4. Click Import data.
 *
 * The pipe character "|" is used as a delimiter inside the answers and wordBank columns.
 * The setupSql column contains multi-line SQL; the CSV quoting preserves the line breaks.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// RFC 4180 CSV: quote any field that contains a comma, double-quote, or newline.
function csvField(value) {
  const str = String(value ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replaceAll('"', '""') + '"'
  }
  return str
}

function csvRow(fields) {
  return fields.map(csvField).join(',')
}

// ---------- questions.csv ----------

const questions = JSON.parse(
  readFileSync(join(root, 'src', 'data', 'fallback', 'questions.json'), 'utf8')
)

const questionLines = [
  csvRow(['id', 'tier', 'topic', 'dataset', 'mode', 'prompt', 'template',
          'answers', 'wordBank', 'expectedSql', 'orderMatters', 'hint', 'explanation']),
  ...questions.map((q) =>
    csvRow([
      q.id,
      q.tier,
      q.topic,
      q.dataset,
      q.mode,
      q.prompt,
      q.template,
      q.answers.join('|'),
      q.wordBank.join('|'),
      q.expectedSql,
      q.orderMatters ? 'TRUE' : 'FALSE',
      q.hint,
      q.explanation,
    ])
  ),
]

writeFileSync(join(root, 'questions.csv'), questionLines.join('\n'), 'utf8')
console.log(`questions.csv written  (${questions.length} rows)`)

// ---------- datasets.csv ----------

const datasetsDir = join(root, 'src', 'data', 'fallback', 'datasets')
const sqlFiles = readdirSync(datasetsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()

const datasetLines = [
  csvRow(['name', 'setupSql']),
  ...sqlFiles.map((file) => {
    const name = basename(file, '.sql')
    const setupSql = readFileSync(join(datasetsDir, file), 'utf8')
    return csvRow([name, setupSql])
  }),
]

writeFileSync(join(root, 'datasets.csv'), datasetLines.join('\n'), 'utf8')
console.log(`datasets.csv written   (${sqlFiles.length} rows)`)

console.log('\nImport questions.csv into the "questions" tab and datasets.csv into the "datasets" tab.')
console.log('Then delete both CSV files — they are not needed after import.')
