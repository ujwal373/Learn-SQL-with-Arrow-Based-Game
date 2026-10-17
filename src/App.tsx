import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Board from './components/Board.tsx'
import type { BoardHandle } from './components/Board.tsx'
import ChallengeModal from './components/ChallengeModal.tsx'
import LeaderboardModal from './components/LeaderboardModal.tsx'
import {
  BulbIcon,
  ExitFullscreenIcon,
  FullscreenIcon,
  GearIcon,
  HeartIcon,
  MoonIcon,
  PlayIcon,
  RestartIcon,
  SpeakerOffIcon,
  SpeakerOnIcon,
  SunIcon,
} from './components/icons.tsx'
import { isSoundEnabled, playSound, setSoundEnabled } from './game/sound.ts'
import { boundsOf } from './game/arrow.ts'
import type { Bounds } from './game/arrow.ts'
import { getBlocker, findHintArrow } from './game/blocking.ts'
import {
  BASE_ARROW_SCORE,
  BLOCKED_TAP_LIVES_LOST,
  COMBO_CAP,
  EXTRA_HINT_SCORE_COST,
  FEEDBACK_MS,
  FREE_HINTS_PER_LEVEL,
  LIVES_PER_GAME,
} from './game/constants.ts'
import { QuestionDeck } from './game/curriculum.ts'
import { getExitInfo } from './game/exit.ts'
import { generateBoard } from './game/levels.ts'
import type { BoardArrow } from './game/types.ts'
import { checkAnswer, describeSchema, openDatabase } from './sql/check.ts'
import type { SchemaTable } from './sql/check.ts'
import { loadSql } from './sql/engine.ts'
import { sheetsStorage } from './storage/sheetsStorage.ts'
import type { Dataset, Question } from './storage/types.ts'
import { useTheme } from './theme.ts'
import type { SqlJsStatic } from 'sql.js'

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

// The arrow that was tapped while blocked, and the arrow that was in its way. After a wrong SQL
// answer the arrow shakes too, but nothing is blocking it, so blockerId is null.
interface BlockedInfo {
  shakeId: string
  blockerId: string | null
  nonce: number
}

// Everything the SQL challenges need. It loads once, in the background, while the player starts.
interface SqlData {
  SQL: SqlJsStatic
  questions: Question[]
  datasets: Dataset[]
}

// The challenge that is open: which arrow it will fire, and the question that was drawn for it.
interface Challenge {
  arrowId: string
  question: Question
  setupSql: string
  schema: SchemaTable[]
  seed: number
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

// The game screen. Tapping a free arrow opens a SQL challenge. A correct answer fires the arrow.
// A wrong answer costs a life. Combo multiplier rewards consecutive correct answers.
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

  // Consecutive correct answers without a mistake. Resets to 1 on any life loss.
  const [combo, setCombo] = useState(1)

  // Controls whether the leaderboard modal is open on the game-over screen.
  const [leaderboardOpen, setLeaderboardOpen] = useState(false)

  // Sound toggle. Initialized from localStorage via isSoundEnabled so it survives refresh.
  const [soundOn, setSoundOn] = useState(isSoundEnabled)

  // Run identity: set once per newGame, carried through level progression.
  // runId is used for leaderboard anti-cheat in step 6.
  const runId = useRef<string>(crypto.randomUUID())

  // Highest level the player has reached in this run (advances forward only).
  const highestLevel = useRef<number>(1)

  // Wall-clock time tracking for the leaderboard run duration.
  // Set to Date.now() in a mount effect and on newGame, never during render.
  const runStartMs = useRef<number>(0)
  const pauseStartMs = useRef<number | null>(null)
  const totalPausedMs = useRef<number>(0)
  // Seconds elapsed when the current run ended. Written at game-over; read in the overlay.
  const [finalSeconds, setFinalSeconds] = useState(0)

  // The SQL engine, questions and datasets. Null while they load.
  const [sqlData, setSqlData] = useState<SqlData | null>(null)
  const [sqlFailed, setSqlFailed] = useState(false)
  const [challenge, setChallenge] = useState<Challenge | null>(null)
  // Hands out the questions of the current level. Null means a new one is made on the next tap.
  const deck = useRef<QuestionDeck | null>(null)
  const challengeCount = useRef(0)

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

  // Set the run start time once after the first render. Not during render to satisfy purity rules.
  useEffect(() => {
    runStartMs.current = Date.now()
  }, [])

  // Load the SQL engine (a small wasm file) and the question bank as soon as the page opens.
  useEffect(() => {
    let cancelled = false
    Promise.all([loadSql(), sheetsStorage.getQuestions(), sheetsStorage.getDatasets()])
      .then(([SQL, questions, datasets]) => {
        if (!cancelled) setSqlData({ SQL, questions, datasets })
      })
      .catch(() => {
        if (!cancelled) setSqlFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // Accumulate paused time so run duration is accurate.
  useEffect(() => {
    if (paused) {
      pauseStartMs.current = Date.now()
    } else if (pauseStartMs.current !== null) {
      totalPausedMs.current += Date.now() - pauseStartMs.current
      pauseStartMs.current = null
    }
  }, [paused])

  // Returns how many seconds have elapsed in the current run, excluding paused time.
  function elapsedSeconds(): number {
    const paused_so_far =
      totalPausedMs.current + (pauseStartMs.current !== null ? Date.now() - pauseStartMs.current : 0)
    return Math.floor((Date.now() - runStartMs.current - paused_so_far) / 1000)
  }

  function clearTimers() {
    exitTimers.current.forEach((t) => window.clearTimeout(t))
    exitTimers.current = []
    window.clearTimeout(feedbackTimer.current)
    setBlocked(null)
    setMessage(null)
    setHintId(null)
    setChallenge(null)
    // Every board starts with a fresh set of questions.
    deck.current = null
  }

  function showMessage(text: string, tone: Message['tone'], clearBlocked: boolean) {
    setMessage({ text, tone })
    window.clearTimeout(feedbackTimer.current)
    feedbackTimer.current = window.setTimeout(() => {
      setMessage(null)
      if (clearBlocked) setBlocked(null)
    }, FEEDBACK_MS)
  }

  // Loads the next level. Lives, score, and combo carry over; they belong to the run.
  function loadLevel(level: number) {
    clearTimers()
    boardKey.current += 1
    setGame(createLevel(level, boardKey.current))
    setHintsUsed(0)
    levelStartScore.current = score
    penaltyPaid.current = 0
    setStatus('playing')
    setPaused(false)
    if (level > highestLevel.current) highestLevel.current = level
  }

  // Starts a fresh game: full lives, zero score, combo 1, at the chosen level.
  function newGame(level: number) {
    clearTimers()
    boardKey.current += 1
    setGame(createLevel(level, boardKey.current))
    setLives(LIVES_PER_GAME)
    setScore(0)
    setCombo(1)
    setHintsUsed(0)
    levelStartScore.current = 0
    penaltyPaid.current = 0
    highestLevel.current = level
    runId.current = crypto.randomUUID()
    runStartMs.current = Date.now()
    totalPausedMs.current = 0
    pauseStartMs.current = null
    setLeaderboardOpen(false)
    setStatus('playing')
    setPaused(false)
  }

  // Puts the arrows back. Lives stay as they are and score returns to where the level began.
  // Combo resets because mistakes leading to a restart should not persist.
  function restartLevel() {
    clearTimers()
    boardKey.current += 1
    setGame(createLevel(game.level, boardKey.current))
    setScore(Math.max(0, levelStartScore.current - penaltyPaid.current))
    setCombo(1)
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
      playSound('blocked')
      navigator.vibrate?.(80)
      const livesLeft = Math.max(0, lives - BLOCKED_TAP_LIVES_LOST)
      nonce.current += 1
      setLives(livesLeft)
      setCombo(1)
      setBlocked({ shakeId: id, blockerId: blocker.id, nonce: nonce.current })
      if (livesLeft === 0) {
        window.clearTimeout(feedbackTimer.current)
        setMessage(null)
        setFinalSeconds(elapsedSeconds())
        playSound('gameOver')
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

    // A free arrow: ask a SQL question. The arrow only leaves if the answer is right.
    playSound('tap')
    setBlocked(null)
    openChallenge(id)
  }

  function openChallenge(arrowId: string) {
    if (sqlData === null) {
      showMessage(
        sqlFailed ? 'The SQL engine could not load. Reload the page and try again.' : 'Loading the SQL engine...',
        'info',
        false,
      )
      return
    }
    if (deck.current === null) {
      deck.current = new QuestionDeck(sqlData.questions, game.level, game.key * 7919 + game.level)
    }
    const question = deck.current.next()
    const dataset = sqlData.datasets.find((d) => d.name === question.dataset)
    if (!dataset) {
      showMessage(`Question ${question.id} uses an unknown dataset. Tap again for another question.`, 'danger', false)
      return
    }

    // Read the table and column names from a throwaway database, to show them to the player.
    const db = openDatabase(sqlData.SQL, dataset.setupSql)
    const schema = describeSchema(db)
    db.close()

    challengeCount.current += 1
    setChallenge({ arrowId, question, setupSql: dataset.setupSql, schema, seed: challengeCount.current })
  }

  function checkChallenge(sql: string) {
    // The modal only opens once the engine is loaded, so sqlData is set here.
    return checkAnswer(sqlData!.SQL, challenge!.setupSql, challenge!.question, sql)
  }

  function finishChallenge(correct: boolean) {
    if (challenge === null) return
    const arrowId = challenge.arrowId
    setChallenge(null)
    if (correct) {
      playSound('correct')
      fireArrow(arrowId)
      return
    }

    // Wrong answer: the arrow shakes, a life is lost, combo resets, and the next tap draws a new question.
    playSound('wrong')
    navigator.vibrate?.(120)
    const livesLeft = Math.max(0, lives - 1)
    nonce.current += 1
    setLives(livesLeft)
    setCombo(1)
    setBlocked({ shakeId: arrowId, blockerId: null, nonce: nonce.current })
    if (livesLeft === 0) {
      window.clearTimeout(feedbackTimer.current)
      setMessage(null)
      setFinalSeconds(elapsedSeconds())
      playSound('gameOver')
      setStatus('gameover')
    } else {
      showMessage(`Wrong answer. You lost a life. ${livesLeft} left.`, 'danger', true)
    }
  }

  // Sends an arrow off the board after a correct answer. Score = base * combo, then combo grows.
  function fireArrow(id: string) {
    const arrow = game.arrows.find((a) => a.id === id)
    if (!arrow || arrow.status !== 'active') return
    const active = game.arrows.filter((a) => a.status === 'active')

    // Read combo from state via functional update to avoid stale closure.
    setCombo((c) => {
      const earned = BASE_ARROW_SCORE * c
      setScore((s) => s + earned)
      return Math.min(c + 1, COMBO_CAP)
    })
    playSound('slide')
    if (combo > 2) playSound('combo', combo)

    setGame((g) => ({
      ...g,
      arrows: g.arrows.map((a) => (a.id === id ? { ...a, status: 'exiting' as const } : a)),
    }))

    // Remove the arrow once it has slid off the board. The last arrow finishes the level.
    const isLast = active.length === 1
    const { durationMs } = getExitInfo(arrow, game.rows, game.cols)
    const timer = window.setTimeout(() => {
      setGame((g) => ({ ...g, arrows: g.arrows.filter((a) => a.id !== id) }))
      if (isLast) {
        playSound('levelUp')
        navigator.vibrate?.([50, 30, 80])
        setStatus('cleared')
      }
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

  function toggleSound() {
    setSoundOn((prev) => {
      const next = !prev
      setSoundEnabled(next)
      return next
    })
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen().catch(() => undefined)
  }

  const activeCount = game.arrows.filter((a) => a.status === 'active').length
  const freeHintsLeft = Math.max(0, FREE_HINTS_PER_LEVEL - hintsUsed)
  const canPlay = status === 'playing' && !paused

  // Score earned on this level (used in the cleared overlay).
  const levelScore = score - Math.max(0, levelStartScore.current - penaltyPaid.current)

  return (
    <main className="game">
      <header className="topbar">
        <div className="topbar__hearts" role="img" aria-label={`${lives} of ${LIVES_PER_GAME} lives left`}>
          {Array.from({ length: LIVES_PER_GAME }, (_, i) => (
            <HeartIcon key={i} filled={i < lives} />
          ))}
        </div>

        <span className="topbar__lvl">LVL {game.level}</span>

        <div className="topbar__actions">
          {canFullscreen && (
            <button
              type="button"
              className="icon-btn icon-btn--sm"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? 'Exit full screen' : 'Full screen'}
            >
              {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
            </button>
          )}
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            onClick={() => setPaused((p) => !p)}
            disabled={status !== 'playing'}
            aria-label={paused ? 'Resume' : 'Pause'}
          >
            {paused ? <PlayIcon /> : <GearIcon />}
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
        {combo > 1 && (
          <span className="combo-badge" aria-label={`${combo}x combo`}>
            x{combo} COMBO
          </span>
        )}
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

        {challenge && (
          <ChallengeModal
            key={challenge.seed}
            question={challenge.question}
            level={game.level}
            schema={challenge.schema}
            seed={challenge.seed}
            livesLeft={lives}
            onCheck={checkChallenge}
            onFinish={finishChallenge}
            onCancel={() => setChallenge(null)}
          />
        )}

        {status === 'cleared' && (
          <div className="overlay">
            <div className="overlay__card">
              <h2>Level {game.level} cleared</h2>
              <p>Score this level: {levelScore}</p>
              <p>Total score: {score}</p>
              <div className="overlay__actions">
                <button type="button" className="btn btn--primary" onClick={() => loadLevel(game.level + 1)}>
                  Next level
                </button>
              </div>
            </div>
          </div>
        )}

        {status === 'gameover' && !leaderboardOpen && (
          <div className="overlay">
            <div className="overlay__card">
              <h2>Out of lives</h2>
              <p>Level {highestLevel.current}</p>
              <p>Score {score}</p>
              <p>Time {finalSeconds}s</p>
              <div className="overlay__actions">
                <button type="button" className="btn btn--primary" onClick={() => setLeaderboardOpen(true)}>
                  View leaderboard
                </button>
                <button type="button" className="btn" onClick={() => newGame(game.level)}>
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

        {status === 'gameover' && leaderboardOpen && (
          <LeaderboardModal
            score={score}
            highestLevel={highestLevel.current}
            runSeconds={finalSeconds}
            runId={runId.current}
            onClose={() => setLeaderboardOpen(false)}
          />
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

        <button type="button" className="icon-btn" onClick={restartLevel} aria-label="Restart level">
          <RestartIcon />
        </button>

        <button
          type="button"
          className="icon-btn"
          onClick={toggleSound}
          aria-label={soundOn ? 'Mute sounds' : 'Unmute sounds'}
        >
          {soundOn ? <SpeakerOnIcon /> : <SpeakerOffIcon />}
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

      {import.meta.env.DEV && (
        <details className="dev">
          <summary>Dev tools</summary>
          <div className="dev__buttons">
            <button type="button" className="btn" disabled={game.level <= 1} onClick={() => loadLevel(game.level - 1)}>
              Previous level
            </button>
            <button type="button" className="btn" onClick={() => loadLevel(game.level + 1)}>
              Next level
            </button>
          </div>
        </details>
      )}
    </main>
  )
}
