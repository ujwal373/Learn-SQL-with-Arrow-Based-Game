import { useState } from 'react'
import type { LeaderboardEntry } from '../storage/types.ts'
import { sheetsStorage } from '../storage/sheetsStorage.ts'
import type { ScoreSubmission } from '../storage/types.ts'

interface Props {
  score: number
  highestLevel: number
  runSeconds: number
  runId: string
  onClose: () => void
}

type View = 'form' | 'loading' | 'board' | 'error'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export default function LeaderboardModal({ score, highestLevel, runSeconds, runId, onClose }: Props) {
  const [view, setView] = useState<View>('form')
  const [name, setName] = useState('')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [submittedName, setSubmittedName] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  async function loadBoard() {
    const board = await sheetsStorage.getLeaderboard(20)
    setEntries(board)
  }

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setView('loading')
    try {
      const submission: ScoreSubmission = {
        playerName: trimmed,
        score,
        highestLevel,
        runSeconds,
        runId,
      }
      await sheetsStorage.submitScore(submission)
      setSubmittedName(trimmed)
      await loadBoard()
      setView('board')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
      setView('error')
    }
  }

  async function handleSkip() {
    setView('loading')
    await loadBoard()
    setView('board')
  }

  return (
    <div className="challenge-backdrop">
      <div className="challenge leaderboard">

        {view === 'form' && (
          <>
            <h2 className="leaderboard__title">Submit your score</h2>
            <p className="leaderboard__summary">
              Level {highestLevel}&nbsp;·&nbsp;{score} pts&nbsp;·&nbsp;{formatTime(runSeconds)}
            </p>
            <form onSubmit={handleSubmit} className="leaderboard__form">
              <input
                className="leaderboard__input"
                type="text"
                placeholder="Your name (max 30 characters)"
                maxLength={30}
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              <div className="leaderboard__actions">
                <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
                  Submit
                </button>
                <button type="button" className="btn" onClick={handleSkip}>
                  Skip — just view
                </button>
                <button type="button" className="btn" onClick={onClose}>
                  Close
                </button>
              </div>
            </form>
          </>
        )}

        {view === 'loading' && (
          <p className="leaderboard__loading">Loading…</p>
        )}

        {view === 'board' && (
          <>
            <h2 className="leaderboard__title">Leaderboard</h2>
            {entries.length === 0 ? (
              <p className="leaderboard__empty">No scores yet. Be the first!</p>
            ) : (
              <div className="leaderboard__scroll">
                <table className="leaderboard__table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Score</th>
                      <th>Level</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, i) => {
                      const isOwn = submittedName !== '' &&
                        entry.playerName === submittedName &&
                        entry.score === score
                      return (
                        <tr key={i} className={isOwn ? 'leaderboard__row--mine' : undefined}>
                          <td>{i + 1}</td>
                          <td>{entry.playerName}</td>
                          <td>{entry.score}</td>
                          <td>{entry.highestLevel}</td>
                          <td>{formatTime(entry.runSeconds)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="leaderboard__actions">
              <button type="button" className="btn btn--primary" onClick={onClose}>
                Back to game
              </button>
            </div>
          </>
        )}

        {view === 'error' && (
          <>
            <h2 className="leaderboard__title">Could not submit</h2>
            <p className="leaderboard__error">{errorMsg}</p>
            <div className="leaderboard__actions">
              <button type="button" className="btn btn--primary" onClick={() => setView('form')}>
                Try again
              </button>
              <button type="button" className="btn" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}
