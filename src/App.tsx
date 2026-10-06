import { useEffect, useRef, useState } from 'react'
import Board from './components/Board.tsx'
import { getBlocker } from './game/blocking.ts'
import {
  BLOCKED_FEEDBACK_MS,
  BLOCKED_TAP_SCORE_PENALTY,
  CLEAR_ARROW_SCORE,
  EXIT_ANIMATION_MS,
} from './game/constants.ts'
import { generateBoard } from './game/levels.ts'
import type { BoardArrow } from './game/types.ts'

interface GameState {
  level: number
  rows: number
  cols: number
  arrows: BoardArrow[]
}

// Shown briefly after a blocked tap.
interface Feedback {
  shakeId: string
  blockerId: string
  nonce: number
  message: string
}

function createGame(level: number): GameState {
  const board = generateBoard(level)
  return {
    level,
    rows: board.rows,
    cols: board.cols,
    arrows: board.arrows.map((a) => ({ ...a, status: 'active' as const })),
  }
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
    </div>
  )
}

// Step 2 version of the game screen. A tap on a clear arrow removes it directly.
// In step 3 that tap will open the SQL challenge instead, and in step 4 score, combo
// and lives move into proper game state.
export default function App() {
  const [game, setGame] = useState<GameState>(() => createGame(1))
  const [score, setScore] = useState(0)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  // Timers for removing arrows after their fly off animation, and for clearing feedback.
  const exitTimers = useRef<number[]>([])
  const feedbackTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    const exits = exitTimers
    return () => {
      exits.current.forEach((t) => window.clearTimeout(t))
      window.clearTimeout(feedbackTimer.current)
    }
  }, [])

  function startLevel(level: number) {
    // Cancel pending removals so they cannot delete arrows on the fresh board.
    exitTimers.current.forEach((t) => window.clearTimeout(t))
    exitTimers.current = []
    window.clearTimeout(feedbackTimer.current)
    setFeedback(null)
    setGame(createGame(level))
  }

  function handleTap(id: string) {
    const arrow = game.arrows.find((a) => a.id === id)
    if (!arrow || arrow.status !== 'active') return

    // Arrows that are already flying off no longer block anything.
    const active = game.arrows.filter((a) => a.status === 'active')
    const blocker = getBlocker(arrow, active, game.rows, game.cols)

    if (blocker) {
      setScore((s) => Math.max(0, s - BLOCKED_TAP_SCORE_PENALTY))
      const penaltyText = BLOCKED_TAP_SCORE_PENALTY > 0 ? ` -${BLOCKED_TAP_SCORE_PENALTY} points.` : ''
      setFeedback((prev) => ({
        shakeId: id,
        blockerId: blocker.id,
        nonce: (prev?.nonce ?? 0) + 1,
        message: `Blocked by the arrow in row ${blocker.row + 1}, column ${blocker.col + 1}.${penaltyText}`,
      }))
      window.clearTimeout(feedbackTimer.current)
      feedbackTimer.current = window.setTimeout(() => setFeedback(null), BLOCKED_FEEDBACK_MS)
      return
    }

    setScore((s) => s + CLEAR_ARROW_SCORE)
    setGame((g) => ({
      ...g,
      arrows: g.arrows.map((a) => (a.id === id ? { ...a, status: 'exiting' as const } : a)),
    }))
    const timer = window.setTimeout(() => {
      setGame((g) => ({ ...g, arrows: g.arrows.filter((a) => a.id !== id) }))
    }, EXIT_ANIMATION_MS)
    exitTimers.current.push(timer)
  }

  const activeCount = game.arrows.filter((a) => a.status === 'active').length
  const cleared = game.arrows.length === 0

  return (
    <main className="app">
      <h1>QueryOut</h1>
      <p className="tagline">Clear the board. Learn SQL.</p>

      <div className="stage">
        <div className="hud">
          <Stat label="Level" value={game.level} />
          <Stat label="Arrows left" value={activeCount} />
          <Stat label="Score" value={score} />
        </div>

        <p className="feedback" role="status" aria-live="polite">
          {feedback?.message ?? ''}
        </p>

        <div className="board-wrap">
          <Board
            rows={game.rows}
            cols={game.cols}
            arrows={game.arrows}
            shakeId={feedback?.shakeId ?? null}
            blockerId={feedback?.blockerId ?? null}
            shakeNonce={feedback?.nonce ?? 0}
            onTap={handleTap}
          />

          {cleared && (
            <div className="overlay">
              <h2>Level {game.level} cleared</h2>
              <p>Score {score}</p>
              <div>
                <button type="button" className="btn btn--primary" onClick={() => startLevel(game.level + 1)}>
                  Next level
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="controls">
          <button type="button" className="btn" onClick={() => startLevel(game.level)}>
            Restart level
          </button>
          <button
            type="button"
            className="btn"
            disabled={game.level <= 1}
            onClick={() => startLevel(game.level - 1)}
          >
            Previous level (dev)
          </button>
          <button type="button" className="btn" onClick={() => startLevel(game.level + 1)}>
            Next level (dev)
          </button>
        </div>

        <p className="muted note">
          Step 2 preview. Tap an arrow with a clear path to send it off the board. SQL challenges arrive in step 3.
        </p>
      </div>
    </main>
  )
}
