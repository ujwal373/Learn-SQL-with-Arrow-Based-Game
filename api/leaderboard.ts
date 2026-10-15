// Vercel Node.js serverless function for the global leaderboard.
//
// GET  /api/leaderboard — returns top 20 entries sorted by score descending.
// POST /api/leaderboard — validates and appends a new score submission.
//
// Required environment variables (set in Vercel dashboard, never committed):
//   GOOGLE_SHEETS_API_KEY          — same read-only key used by api/questions.ts
//   SPREADSHEET_ID                 — same spreadsheet
//   GOOGLE_SERVICE_ACCOUNT_EMAIL   — service account email (needs Editor access to the sheet)
//   GOOGLE_PRIVATE_KEY             — RSA private key; paste with literal \n in Vercel dashboard
//
// Leaderboard tab column layout (tab named "leaderboard", row 1 is the header):
//   A playerName  B score  C highestLevel  D runSeconds  E runId  F timestamp

import { createSign } from 'node:crypto'
import type { LeaderboardEntry, ScoreSubmission } from '../src/storage/types.ts'

type Req = {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}
type Res = {
  setHeader(name: string, value: string): void
  json(data: unknown): void
  status(code: number): { json(data: unknown): void }
}

// ── Rate limiting ─────────────────────────────────────────────────────────────
// In-memory; resets on cold start. Good enough for a portfolio project.
const recentSubmissions = new Map<string, number>()
const RATE_LIMIT_MS = 60_000

function getIp(req: Req): string {
  const fwd = req.headers['x-forwarded-for']
  if (typeof fwd === 'string') return fwd.split(',')[0].trim()
  if (Array.isArray(fwd)) return fwd[0]
  return 'unknown'
}

function checkRateLimit(ip: string): boolean {
  const last = recentSubmissions.get(ip)
  if (last !== undefined && Date.now() - last < RATE_LIMIT_MS) return false
  recentSubmissions.set(ip, Date.now())
  // Prune old entries so the Map does not grow unbounded in a long-lived instance.
  if (recentSubmissions.size > 500) {
    const cutoff = Date.now() - RATE_LIMIT_MS
    for (const [key, time] of recentSubmissions) {
      if (time < cutoff) recentSubmissions.delete(key)
    }
  }
  return true
}

// ── Input validation and sanitisation ────────────────────────────────────────
// These constants match src/game/constants.ts; kept here to avoid importing browser code.
const BASE_SCORE = 100
const COMBO_CAP = 8
const MAX_ARROWS_PER_LEVEL = 300 // generous upper bound for score validation

function sanitiseName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const clean = raw
    .replace(/<[^>]*>/g, '')         // strip HTML tags
    .replace(/[\x00-\x1f\x7f]/g, '') // strip control characters
    .trim()
    .slice(0, 30)
  return clean.length >= 1 ? clean : null
}

type ValidationResult =
  | { ok: true; data: ScoreSubmission }
  | { ok: false; error: string }

function validate(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Invalid body' }
  const b = body as Record<string, unknown>

  const playerName = sanitiseName(b['playerName'])
  if (!playerName) return { ok: false, error: 'playerName must be 1-30 non-empty characters' }

  const score = Number(b['score'])
  const highestLevel = Number(b['highestLevel'])
  const runSeconds = Number(b['runSeconds'])
  const runId = typeof b['runId'] === 'string' ? b['runId'].slice(0, 64) : ''

  if (!Number.isInteger(score) || score < 0) return { ok: false, error: 'Invalid score' }
  if (!Number.isInteger(highestLevel) || highestLevel < 1) return { ok: false, error: 'Invalid highestLevel' }
  if (!Number.isInteger(runSeconds) || runSeconds < 0) return { ok: false, error: 'Invalid runSeconds' }
  if (!runId) return { ok: false, error: 'Missing runId' }

  // Upper bound: very generous, just catches obviously impossible scores.
  const maxScore = highestLevel * MAX_ARROWS_PER_LEVEL * BASE_SCORE * COMBO_CAP
  if (score > maxScore) return { ok: false, error: 'Score exceeds possible maximum for that level' }

  // Minimum time: 10 seconds per level — prevents instant-completion bots.
  if (runSeconds < highestLevel * 10) return { ok: false, error: 'Run time too short for that level' }

  return { ok: true, data: { playerName, score, highestLevel, runSeconds, runId } }
}

// ── Service account JWT auth ──────────────────────────────────────────────────
let tokenCache: { value: string; expiresAt: number } | null = null

function base64url(str: string): string {
  return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function makeJwt(email: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(
    JSON.stringify({
      iss: email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }),
  )
  const unsigned = `${header}.${claims}`
  const signer = createSign('RSA-SHA256')
  signer.update(unsigned)
  const sig = signer.sign(privateKey, 'base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  return `${unsigned}.${sig}`
}

async function getAccessToken(email: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  // Reuse the cached token until 5 minutes before it expires.
  if (tokenCache !== null && tokenCache.expiresAt > now + 300) return tokenCache.value

  const jwt = makeJwt(email, privateKey)
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Token exchange failed (${res.status}): ${detail}`)
  }
  const data = (await res.json()) as { access_token: string }
  tokenCache = { value: data.access_token, expiresAt: now + 3600 }
  return data.access_token
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req: Req, res: Res): Promise<void> {
  const apiKey = process.env['GOOGLE_SHEETS_API_KEY']
  const sheetId = process.env['SPREADSHEET_ID']

  if (!apiKey || !sheetId) {
    res.status(500).json({ error: 'Server not configured' })
    return
  }

  // GET — read and return the top 20 entries
  if (req.method === 'GET' || req.method === undefined) {
    const range = encodeURIComponent('leaderboard!A2:F')
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`Sheets API ${response.status}`)
      const body = (await response.json()) as { values?: string[][] }
      const rows = body.values ?? []
      const entries: LeaderboardEntry[] = rows
        .filter((r) => r.length >= 4 && r[0] && r[1])
        .map((r) => ({
          playerName: r[0],
          score: Number(r[1]),
          highestLevel: Number(r[2]),
          runSeconds: Number(r[3]),
          // r[4] is runId (internal); r[5] is the ISO timestamp
          timestamp: r[5] ?? '',
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 20)
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=60')
      res.json(entries)
    } catch (err) {
      res.status(502).json({ error: String(err) })
    }
    return
  }

  // POST — validate and append a new entry
  if (req.method === 'POST') {
    if (!checkRateLimit(getIp(req))) {
      res.status(429).json({ error: 'Too many submissions. Wait a minute and try again.' })
      return
    }

    const result = validate(req.body)
    if (!result.ok) {
      res.status(400).json({ error: result.error })
      return
    }
    const { playerName, score, highestLevel, runSeconds, runId } = result.data

    const email = process.env['GOOGLE_SERVICE_ACCOUNT_EMAIL']
    const rawKey = process.env['GOOGLE_PRIVATE_KEY']
    if (!email || !rawKey) {
      res.status(500).json({ error: 'Leaderboard write not configured' })
      return
    }
    // Vercel stores the key with literal \n; replace them with real newlines for the crypto module.
    const privateKey = rawKey.replace(/\\n/g, '\n')

    try {
      const token = await getAccessToken(email, privateKey)
      const range = encodeURIComponent('leaderboard!A:F')
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=USER_ENTERED`
      const appendRes = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          values: [[playerName, score, highestLevel, runSeconds, runId, new Date().toISOString()]],
        }),
      })
      if (!appendRes.ok) {
        const detail = await appendRes.text()
        throw new Error(`Sheets append failed (${appendRes.status}): ${detail}`)
      }
      res.json({ ok: true })
    } catch (err) {
      res.status(502).json({ error: String(err) })
    }
    return
  }

  res.status(405).json({ error: 'Method not allowed' })
}
