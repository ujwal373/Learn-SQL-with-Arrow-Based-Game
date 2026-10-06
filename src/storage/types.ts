// The one interface the game talks to for all remote data.
// Today the implementation will be Google Sheets behind Vercel serverless functions.
// Later it can be swapped for Supabase by writing a second implementation of this interface,
// with no changes to game code.

export interface Question {
  id: string
  level: number
  topic: string
  datasetName: string
  promptText: string
  // Blanks are marked like ___1___, ___2___
  queryTemplate: string
  // Accepted values per blank, indexed by blank number minus one
  answers: string[][]
  expectedResultSql: string
  hint: string
  difficulty: number
}

export interface Dataset {
  name: string
  // Each table is a list of rows. Keep every dataset under about 50 rows so sql.js loads fast.
  tables: Record<string, Record<string, string | number | null>[]>
}

export interface LeaderboardEntry {
  playerName: string
  score: number
  highestLevel: number
  runSeconds: number
  timestamp: string
}

export interface ScoreSubmission {
  playerName: string
  score: number
  highestLevel: number
  runSeconds: number
  runId: string
}

export interface GameStorage {
  getQuestions(): Promise<Question[]>
  getDatasets(): Promise<Dataset[]>
  getLeaderboard(limit: number): Promise<LeaderboardEntry[]>
  submitScore(entry: ScoreSubmission): Promise<void>
}
