// GameStorage implementation that fetches live data from the Vercel serverless functions in api/.
// If any fetch fails (network error, non-OK status, timeout) it falls back transparently to the
// bundled question bank and datasets in src/data/fallback. The leaderboard methods call the real
// api/leaderboard.ts endpoint added in step 6.

import { fallbackStorage } from './fallbackStorage.ts'
import type { Dataset, GameStorage, LeaderboardEntry, Question, ScoreSubmission } from './types.ts'

// How long to wait for a serverless function before giving up and using bundled data.
const FETCH_TIMEOUT_MS = 5000

// In-memory cache for the current browser session. The CDN also caches responses for 5 minutes,
// but this avoids a round trip on every level load within the same page.
let questionsCache: Question[] | null = null
let datasetsCache: Dataset[] | null = null

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(path, { signal: controller.signal, ...init })
    if (!res.ok) {
      // Try to surface the server's error message so the UI can show it.
      let msg = `HTTP ${res.status}`
      try {
        const body = (await res.json()) as { error?: string }
        if (body.error) msg = body.error
      } catch { /* ignore if body is not JSON */ }
      throw new Error(msg)
    }
    // POST responses from /api/leaderboard return { ok: true }, not an array.
    if (init?.method === 'POST') return undefined as T
    return (await res.json()) as T
  } finally {
    window.clearTimeout(timer)
  }
}

export const sheetsStorage: GameStorage = {
  async getQuestions(): Promise<Question[]> {
    if (questionsCache) return questionsCache
    try {
      const questions = await fetchJson<Question[]>('/api/questions')
      if (questions.length === 0) return fallbackStorage.getQuestions()
      questionsCache = questions
      return questions
    } catch {
      return fallbackStorage.getQuestions()
    }
  },

  async getDatasets(): Promise<Dataset[]> {
    if (datasetsCache) return datasetsCache
    try {
      const datasets = await fetchJson<Dataset[]>('/api/datasets')
      if (datasets.length === 0) return fallbackStorage.getDatasets()
      datasetsCache = datasets
      return datasets
    } catch {
      return fallbackStorage.getDatasets()
    }
  },

  async getLeaderboard(limit: number): Promise<LeaderboardEntry[]> {
    try {
      const entries = await fetchJson<LeaderboardEntry[]>('/api/leaderboard')
      return entries.slice(0, limit)
    } catch {
      // A leaderboard fetch failure is non-fatal — return an empty board.
      return []
    }
  },

  async submitScore(entry: ScoreSubmission): Promise<void> {
    // Throws on any error (rate limit, validation, network) so the UI can show the message.
    await fetchJson<void>('/api/leaderboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    })
  },
}
