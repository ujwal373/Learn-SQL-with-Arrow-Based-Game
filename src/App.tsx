import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Board from './components/Board.tsx'
import type { BoardHandle } from './components/Board.tsx'
import {
  BulbIcon,
  ExitFullscreenIcon,
  FullscreenIcon,
  HeartIcon,
  MoonIcon,
  PauseIcon,
  PlayIcon,
  RestartIcon,
  SunIcon,
} from './components/icons.tsx'
import { boundsOf } from './game/arrow.ts'
import type { Bounds } from './game/arrow.ts'
import { getBlocker, findHintArrow } from './game/blocking.ts'
import {
  BLOCKED_TAP_LIVES_LOST,
  CLEAR_ARROW_SCORE,
  EXTRA_HINT_SCORE_COST,
  FEEDBACK_MS,
  FREE_HINTS_PER_LEVEL,
  LIVES_PER_GAME,
} from './game/constants.ts'
import { getExitInfo } from './game/exit.ts'
import { generateBoard } from './game/levels.ts'
import type { BoardArrow } from './game/types.ts'
import { useTheme } from './theme.ts'

interface LevelState {
  level: number
  rows: number
  cols: number
  arrows: BoardArrow[]
  // The area covered by the pattern, used to frame the camera.
  focus: Bounds
  // Changes every time a board is loaded, so the camera refits even for a restart of the same level.
  key: number
}

type Status = 'playing' | 'cleared' | 'gameover'

interface Message {
  text: string
  tone: 'danger' | 'info'
}

// The arrow that was tapped while blocked, and the arrow that was in its way.
interface BlockedInfo {
  shakeId: string
  blockerId: string
  nonce: number
}

function createLevel(level: number, key: number): LevelState {
  const board = generateBoard(level)
  return {
    level,
    rows: board.rows,
    cols: board.cols,
    arrows: board.arrows.map((a) => ({ ...a, status: 'active' as const })),
    focus: boundsOf(board.arrows),
    key,
  }
}

// Step 2b version of the game screen. A tap on a free arrow removes it directly. In step 3 that tap
// will open the SQL challenge instead, and in step 4 score and combo move into proper game state.
export default function App() {
  const [theme, toggleTheme] = useTheme()
  const boardRef = useRef<BoardHandle>(null)
  // Counts the boards loaded so far. Level 1 at the start is board number 1.
  const boardKey = useRef(1)

  const [game, setGame] = useState<LevelState>(() => createLevel(1, 1))
  const [lives, setLives] = useState(LIVES_PER_GAME)
  const [score, setScore] = useState(0)
  const [status, setStatus] = useState<Status>('playing')
  const [paused, setPaused] = useState(false)

  // Hints belong to a level. Restarting the level does not give the free hints back.
  const [hintsUsed, setHintsUsed] = useState(0)
  const [hintId, setHintId] = useState<string | null>(null)
  // Score at the start of the level and hint costs paid, so a restart cannot be used to farm points.
  const levelStartScore = useRef(0)
  const penaltyPaid = useRef(0)

  const [blocked, setBlocked] = useState<BlockedInfo | null>(null)
  const [message, setMessage] = useState<Message | null>(null)
  const nonce = useRef(0)

  const exitTimers = useRef<number[]>([])
  const feedbackTimer = useRef<number | undefined>(undefined)

  const [isFullscreen, setIsFullscreen] = useState(false)
  const canFullscreen = typeof document !== 'undefined' && document.fullscreenEnabled

  useEffect(() => {
    const exits = exitTimers
    return () => {
      exits.current.forEach((t) => window.clearTimeout(t))
      window.clearTimeout(feedbackTimer.current)
    }
  }, [])

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  function clearTimers() {
    exitTimers.current.forEach((t) => window.clearTimeout(t))
    exitTimers.current = []
    window.clearTimeout(feedbackTimer.current)
    setBlocked(null)
    setMessage(null)
    setHintId(null)
  }

  function showMessage(text: string, tone: Message['tone'], clearBlocked: boolean) {
    setMessage({ text, tone })
    window.clearTimeout(feedbackTimer.current)
    feedbackTimer.current = window.setTimeout(() => {
      setMessage(null)
      if (clearBlocked) setBlocked(null)
    }, FEEDBACK_MS)
  }

  // Loads a level. Lives and score carry over, because they belong to the game, not the level.
  function loadLevel(level: number) {
    clearTimers()
    boardKey.current += 1
    setGame(createLevel(level, boardKey.current))
    setHintsUsed(0)
    levelStartScore.current = score
    penaltyPaid.current = 0
    setStatus('playing')
    setPaused(false)
  }

  // Starts a fresh game: full lives and a zero score, at the chosen level.
  function newGame(level: number) {
    clearTimers()
    boardKey.current += 1
    setGame(createLevel(level, boardKey.current))
    setLives(LIVES_PER_GAME)
    setScore(0)
    setHintsUsed(0)
    levelStartScore.current = 0
    penaltyPaid.current = 0
    setStatus('playing')
    setPaused(false)
  }

  // Puts the arrows back. Lives stay as they are and score returns to where the level began.
  function restartLevel() {
    clearTimers()
    boardKey.current += 1
    setGame(createLevel(game.level, boardKey.current))
    setScore(Math.max(0, levelStartScore.current - penaltyPaid.current))
    setStatus('playing')
    setPaused(false)
  }

  function handleTap(id: string) {
    if (status !== 'playing' || paused) return
    const arrow = game.arrows.find((a) => a.id === id)
    if (!arrow || arrow.status !== 'active') return

    // Arrows that are already sliding off no longer block anything.
    const active = game.arrows.filter((a) => a.status === 'active')
    const blocker = getBlocker(arrow, active, game.rows, game.cols)
    setHintId(null)

    if (blocker) {
      const livesLeft = Math.max(0, lives - BLOCKED_TAP_LIVES_LOST)
      nonce.current += 1
      setLives(livesLeft)
      setBlocked({ shakeId: id, blockerId: blocker.id, nonce: nonce.current })
      if (livesLeft === 0) {
        window.clearTimeout(feedbackTimer.current)
        setMessage(null)
        setStatus('gameover')
      } else {
        showMessage(
          `Blocked by another arrow. You lost a life. ${livesLeft} left.`,
          'danger',
          true,
        )
      }
      return
    }

    setBlocked(null)
    setScore((s) => s + CLEAR_ARROW_SCORE)
    setGame((g) => ({
      ...g,
      arrows: g.arrows.map((a) => (a.id === id ? { ...a, status: 'exiting' as const } : a)),
    }))

    // Remove the arrow once it has slid off the board. The last arrow finishes the level.
    const isLast = active.length === 1
    const { durationMs } = getExitInfo(arrow, game.rows, game.cols)
    const timer = window.setTimeout(() => {
      setGame((g) => ({ ...g, arrows: g.arrows.filter((a) => a.id !== id) }))
      if (isLast) setStatus('cleared')
    }, durationMs)
    exitTimers.current.push(timer)
  }

  // The board keeps one stable tap function, so its hundreds of arrows do not redraw on every render.
  const tapRef = useRef(handleTap)
  useLayoutEffect(() => {
    tapRef.current = handleTap
  })
  const onTap = useCallback((id: string) => tapRef.current(id), [])

  function handleHint() {
    if (status !== 'playing' || paused) return
    const active = game.arrows.filter((a) => a.status === 'active')
    const pick = findHintArrow(active, game.rows, game.cols)
    if (!pick) return

    const freeLeft = FREE_HINTS_PER_LEVEL - hintsUsed
    if (freeLeft > 0) {
      showMessage(
        freeLeft - 1 > 0
          ? `Hint: this arrow is free. ${freeLeft - 1} free hint left on this level.`
          : 'Hint: this arrow is free. No free hints left on this level.',
        'info',
        false,
      )
    } else {
      const cost = Math.min(score, EXTRA_HINT_SCORE_COST)
      setScore((s) => Math.max(0, s - EXTRA_HINT_SCORE_COST))
      penaltyPaid.current += cost
      showMessage(`Hint: this arrow is free. -${EXTRA_HINT_SCORE_COST} points.`, 'info', false)
    }
    setHintsUsed((n) => n + 1)
    setHintId(pick.id)

    const head = pick.cells[pick.cells.length - 1]
    boardRef.current?.showCell(head.row, head.col)
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen().catch(() => undefined)
  }

  const activeCount = game.arrows.filter((a) => a.status === 'active').length
  const freeHintsLeft = Math.max(0, FREE_HINTS_PER_LEVEL - hintsUsed)
  const canPlay = status === 'playing' && !paused

  return (
    <main className="game">
      <header className="topbar">
        <div className="topbar__side">
          {canFullscreen && (
            <button
              type="button"
              className="icon-btn"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
            >
              {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
            </button>
          )}
        </div>

        <div className="topbar__center">
          <span className="level-label">LEVEL {game.level}</span>
          <div className="hearts" role="img" aria-label={`${lives} of ${LIVES_PER_GAME} lives left`}>
            {Array.from({ length: LIVES_PER_GAME }, (_, i) => (
              <HeartIcon key={i} filled={i < lives} />
            ))}
          </div>
        </div>

        <div className="topbar__side topbar__side--right">
          <button type="button" className="icon-btn" onClick={restartLevel} aria-label="Restart level">
            <RestartIcon />
          </button>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setPaused((p) => !p)}
            disabled={status !== 'playing'}
            aria-label={paused ? 'Resume' : 'Pause'}
          >
            {paused ? <PlayIcon /> : <PauseIcon />}
          </button>
        </div>
      </header>

      <div className="statline">
        <span>
          Arrows left <strong>{activeCount}</strong>
        </span>
        <span>
          Score <strong>{score}</strong>
        </span>
      </div>

      <p
        className="feedback"
        role="status"
        aria-live="polite"
        style={message?.tone === 'info' ? { color: 'var(--muted)' } : undefined}
      >
        {message?.text ?? ''}
      </p>

      <div className="board-wrap">
        <Board
          ref={boardRef}
          rows={game.rows}
          cols={game.cols}
          arrows={game.arrows}
          focus={game.focus}
          boardKey={game.key}
          hintId={hintId}
          shakeId={blocked?.shakeId ?? null}
          blockerId={blocked?.blockerId ?? null}
          shakeNonce={blocked?.nonce ?? 0}
          onTap={onTap}
        />

        {status === 'cleared' && (
          <div className="overlay">
            <div className="overlay__card">
              <h2>Level {game.level} cleared</h2>
              <p>Score {score}</p>
              <div className="overlay__actions">
                <button type="button" className="btn btn--primary" onClick={() => loadLevel(game.level + 1)}>
                  Next level
                </button>
              </div>
            </div>
          </div>
        )}

        {status === 'gameover' && (
          <div className="overlay">
            <div className="overlay__card">
              <h2>Out of lives</h2>
              <p>
                You reached level {game.level} with a score of {score}.
              </p>
              <div className="overlay__actions">
                <button type="button" className="btn btn--primary" onClick={() => newGame(game.level)}>
                  Retry level {game.level} with {LIVES_PER_GAME} lives
                </button>
                {game.level > 1 && (
                  <button type="button" className="btn" onClick={() => newGame(1)}>
                    Start again from level 1
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {status === 'playing' && paused && (
          <div className="overlay">
            <div className="overlay__card">
              <h2>Paused</h2>
              <p>The board is hidden while the game is paused.</p>
              <div className="overlay__actions">
                <button type="button" className="btn btn--primary" onClick={() => setPaused(false)}>
                  Resume
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="bottombar">
        <button type="button" className="btn btn--hint" onClick={handleHint} disabled={!canPlay}>
          <BulbIcon />
          Hint
          <span className="btn__badge">
            {freeHintsLeft > 0 ? `${freeHintsLeft} free` : `-${EXTRA_HINT_SCORE_COST}`}
          </span>
        </button>

        <button
          type="button"
          className="icon-btn"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </footer>

      <details className="dev">
        <summary>Dev tools (removed before launch)</summary>
        <div className="dev__buttons">
          <button type="button" className="btn" disabled={game.level <= 1} onClick={() => loadLevel(game.level - 1)}>
            Previous level
          </button>
          <button type="button" className="btn" onClick={() => loadLevel(game.level + 1)}>
            Next level
          </button>
        </div>
      </details>
    </main>
  )
}
