import questionsJson from '../data/fallback/questions.json'
import type { Dataset, GameStorage, LeaderboardEntry, Question, ScoreSubmission } from './types.ts'

// Reads the question bank and datasets that are bundled with the game. It always works, even offline,
// so it is both the first storage used in development and the safety net once Google Sheets arrives
// in step 5. The leaderboard methods do nothing here, because a global leaderboard needs a server.

// Vite reads every .sql file in the folder as text at build time.
const datasetFiles = import.meta.glob('../data/fallback/datasets/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function toDatasets(files: Record<string, string>): Dataset[] {
  return Object.entries(files).map(([path, setupSql]) => ({
    // "../data/fallback/datasets/school.sql" becomes "school".
    name: path.split('/').pop()!.replace(/\.sql$/, ''),
    setupSql,
  }))
}

export const fallbackStorage: GameStorage = {
  getQuestions(): Promise<Question[]> {
    return Promise.resolve(questionsJson as Question[])
  },

  getDatasets(): Promise<Dataset[]> {
    return Promise.resolve(toDatasets(datasetFiles))
  },

  getLeaderboard(): Promise<LeaderboardEntry[]> {
    return Promise.resolve([])
  },

  submitScore(_entry: ScoreSubmission): Promise<void> {
    return Promise.resolve()
  },
}
