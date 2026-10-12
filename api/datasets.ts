// Vercel Node.js serverless function.
// Reads the "datasets" sheet from Google Sheets and returns a JSON array of Dataset objects.
// Compiled by Vercel at deploy time, not included in the local tsc build.
//
// Required environment variables (set in Vercel dashboard, never committed):
//   GOOGLE_SHEETS_API_KEY  – same key as used by api/questions.ts.
//   SPREADSHEET_ID         – the ID from the spreadsheet URL.
//
// Sheet layout (tab named "datasets", row 1 is the header, data starts at row 2):
//   A  name      e.g. "school"
//   B  setupSql  the full CREATE TABLE and INSERT statements; newlines are preserved by Sheets

import type { Dataset } from '../src/storage/types.ts'

type Res = {
  setHeader(name: string, value: string): void
  json(data: unknown): void
  status(code: number): { json(data: unknown): void; end(msg: string): void }
}

function rowToDataset(row: string[]): Dataset | null {
  if (row.length < 2 || !row[0] || !row[1]) return null
  return {
    name: row[0],
    setupSql: row[1],
  }
}

export default async function handler(_req: unknown, res: Res): Promise<void> {
  const apiKey = process.env['GOOGLE_SHEETS_API_KEY']
  const sheetId = process.env['SPREADSHEET_ID']

  if (!apiKey || !sheetId) {
    res.status(500).json({ error: 'GOOGLE_SHEETS_API_KEY and SPREADSHEET_ID must be set.' })
    return
  }

  const range = encodeURIComponent('datasets!A2:B')
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
  const datasets: Dataset[] = rows.map(rowToDataset).filter((d): d is Dataset => d !== null)

  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300')
  res.json(datasets)
}
