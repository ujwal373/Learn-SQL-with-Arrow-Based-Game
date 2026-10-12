// GameStorage implementation that fetches live data from the Vercel serverless functions in api/.
// If any fetch fails (network error, non-OK status, timeout) it falls back transparently to the
// bundled question bank and datasets in src/data/fallback. The leaderboard methods delegate to
// fallbackStorage and will be replaced in step 6 with the Google Sheets write path.

import { fallbackStorage } from './fallbackStorage.ts'
import type { Dataset, GameStorage, LeaderboardEntry, Question, ScoreSubmission } from './types.ts'

// How long to wait for a serverless function before giving up and using bundled data.
const FETCH_TIMEOUT_MS = 5000

// In-memory cache for the current browser session. The CDN also caches responses for 5 minutes,
// but this avoids a round trip on every level load within the same page.
let questionsCache: Question[] | null = null
let datasetsCache: Dataset[] | null = null

async function fetchJson<T>(path: string): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(path, { signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
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
      // Treat an empty array as "not configured yet" and use the bundled fallback.
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

  // Leaderboard read and write are added in step 6.
  getLeaderboard(limit: number): Promise<LeaderboardEntry[]> {
    return fallbackStorage.getLeaderboard(limit)
  },

  submitScore(entry: ScoreSubmission): Promise<void> {
    return fallbackStorage.submitScore(entry)
  },
}
