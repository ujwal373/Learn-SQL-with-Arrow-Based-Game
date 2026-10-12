// Vercel Node.js serverless function.
// Reads the "questions" sheet from Google Sheets and returns a JSON array of Question objects.
// Compiled by Vercel at deploy time, not included in the local tsc build.
//
// Required environment variables (set in Vercel dashboard, never committed):
//   GOOGLE_SHEETS_API_KEY  – a Google Cloud API key restricted to the Sheets API and your domain.
//   SPREADSHEET_ID         – the ID from the spreadsheet URL.
//
// Sheet layout (tab named "questions", row 1 is the header, data starts at row 2):
//   A  id           e.g. "t1-01"
//   B  tier         number 1-9
//   C  topic        e.g. "SELECT and FROM"
//   D  dataset      e.g. "school"
//   E  mode         "blanks" or "complete"
//   F  prompt       plain-language task description
//   G  template     query skeleton with ___ gaps, or the query start for complete questions
//   H  answers      correct blank values, pipe-separated  e.g. "*" or "name|age"
//   I  wordBank     wrong and right options, pipe-separated (empty for typed questions)
//   J  expectedSql  a full correct query
//   K  orderMatters TRUE or FALSE
//   L  hint         one-sentence hint shown inside the challenge
//   M  explanation  one sentence shown after a correct answer

import type { Question } from '../src/storage/types.ts'

// Minimal Vercel response type – no @vercel/node dependency needed.
type Res = {
  setHeader(name: string, value: string): void
  json(data: unknown): void
  status(code: number): { json(data: unknown): void; end(msg: string): void }
}

function rowToQuestion(row: string[]): Question | null {
  // Skip rows that are missing required fields.
  if (row.length < 13 || !row[0] || !row[9]) return null
  return {
    id: row[0],
    tier: Number(row[1]),
    topic: row[2] ?? '',
    dataset: row[3] ?? '',
    mode: (row[4] === 'complete' ? 'complete' : 'blanks') as Question['mode'],
    prompt: row[5] ?? '',
    template: row[6] ?? '',
    answers: row[7] ? row[7].split('|') : [],
    wordBank: row[8] ? row[8].split('|') : [],
    expectedSql: row[9],
    orderMatters: row[10]?.toUpperCase() === 'TRUE',
    hint: row[11] ?? '',
    explanation: row[12] ?? '',
  }
}

export default async function handler(_req: unknown, res: Res): Promise<void> {
  const apiKey = process.env['GOOGLE_SHEETS_API_KEY']
  const sheetId = process.env['SPREADSHEET_ID']

  if (!apiKey || !sheetId) {
    res.status(500).json({ error: 'GOOGLE_SHEETS_API_KEY and SPREADSHEET_ID must be set.' })
    return
  }

  const range = encodeURIComponent('questions!A2:M')
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`

  let data: { values?: string[][] }
  try {
    const response = await fetch(url)
    if (!response.ok) {
      const body = await response.text()
      res.status(502).json({ error: `Sheets API error ${response.status}`, detail: body })
      return
    }
    data = (await response.json()) as { values?: string[][] }
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach Sheets API', detail: String(err) })
    return
  }

  const rows = data.values ?? []
  const questions: Question[] = rows.map(rowToQuestion).filter((q): q is Question => q !== null)

  // Cache for 5 minutes at the CDN edge so repeated page loads do not hammer the Sheets API.
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
  res.json(questions)
}
