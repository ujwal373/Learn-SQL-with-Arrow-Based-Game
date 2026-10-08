// The one interface the game talks to for all remote data.
// Today the implementation reads bundled files (fallbackStorage.ts). In step 5 a second implementation
// will read Google Sheets through serverless functions, and later one could use Supabase. The game
// code never changes, because it only knows this interface.

// How a question is asked.
//   blanks:   a skeleton query with ___ markers. The player fills every blank, by tapping words
//             from a word bank on early levels or by typing on later levels.
//   complete: a query that is started for the player (the template, which may be empty). The player
//             types the rest of it.
export type QuestionMode = 'blanks' | 'complete'

export interface Question {
  id: string
  // Difficulty tier from 1 (SELECT basics) up to 9 (window functions). See src/game/curriculum.ts.
  tier: number
  topic: string
  // Name of the dataset the query runs on.
  dataset: string
  mode: QuestionMode
  // The task shown to the player, in plain language.
  prompt: string
  // blanks: the query with ___ for each blank. complete: the start of the query.
  template: string
  // blanks: the correct word or words for each blank, in order. Empty for complete questions.
  answers: string[]
  // Words offered on early levels, including wrong ones. Empty means the question is always typed.
  wordBank: string[]
  // A full correct query. Its result is what the player's query is compared with, and it is shown
  // after a wrong answer.
  expectedSql: string
  // True when the order of the rows matters (the query has an ORDER BY).
  orderMatters: boolean
  hint: string
  // One sentence shown after a correct answer.
  explanation: string
}

export interface Dataset {
  name: string
  // SQL that creates and fills the tables, run in the browser by sql.js. Keep datasets small
  // (a few dozen rows) so they load instantly.
  setupSql: string
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
