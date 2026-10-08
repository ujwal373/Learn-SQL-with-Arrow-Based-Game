import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { usesWordBank } from '../game/curriculum.ts'
import { mulberry32 } from '../game/rng.ts'
import { buildQuery, splitTemplate } from '../sql/check.ts'
import type { CheckOutcome, SchemaTable } from '../sql/check.ts'
import type { Question } from '../storage/types.ts'
import ResultTable from './ResultTable.tsx'
import '../styles/challenge.css'

interface Props {
  question: Question
  level: number
  // The tables the query can use, shown so the player knows the column names.
  schema: SchemaTable[]
  // Used to shuffle the word bank, so every challenge shows the words in a new order.
  seed: number
  livesLeft: number
  // Runs the player's query and compares it with the answer. Supplied by the game.
  onCheck: (sql: string) => CheckOutcome
  // Called when the player leaves the feedback screen. correct tells the game what to do next.
  onFinish: (correct: boolean) => void
  // Called when the player gives up before answering. This costs nothing.
  onCancel: () => void
}

function shuffled(words: string[], seed: number): string[] {
  const random = mulberry32(seed)
  const copy = [...words]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

// The SQL challenge. Two kinds of question share this dialog:
//   blanks:   a query with gaps. The player taps words (early levels) or types into each gap.
//   complete: the start of a query is given and the player types the rest.
export default function ChallengeModal({ question, level, schema, seed, livesLeft, onCheck, onFinish, onCancel }: Props) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const continueRef = useRef<HTMLButtonElement>(null)

  const isBlanks = question.mode === 'blanks'
  const blankCount = isBlanks ? splitTemplate(question.template).length - 1 : 1
  const pickWords = usesWordBank(level, question)
  const bank = useMemo(() => shuffled(question.wordBank, seed), [question.wordBank, seed])

  const [inputs, setInputs] = useState<string[]>(() => Array.from({ length: blankCount }, () => ''))
  const [outcome, setOutcome] = useState<CheckOutcome | null>(null)
  const [error, setError] = useState('')
  const [showHint, setShowHint] = useState(false)

  const answered = outcome !== null
  const ready = inputs.every((text) => text.trim() !== '')
  const parts = splitTemplate(question.template)

  // Move focus into the dialog when it opens, and onto the Continue button once it has been answered.
  useEffect(() => {
    const first = dialogRef.current?.querySelector<HTMLElement>('input, textarea, .slot, .word')
    first?.focus()
  }, [])
  useEffect(() => {
    if (answered) continueRef.current?.focus()
  }, [answered])

  function setInput(index: number, text: string) {
    setInputs((prev) => prev.map((old, i) => (i === index ? text : old)))
  }

  // Tapping a word fills the first empty gap. If every gap is full, the last gap is replaced.
  function addWord(word: string) {
    setInputs((prev) => {
      const at = prev.findIndex((text) => text === '')
      const target = at === -1 ? prev.length - 1 : at
      return prev.map((old, i) => (i === target ? word : old))
    })
  }

  function submit(event?: FormEvent) {
    event?.preventDefault()
    if (answered) return
    if (!ready) {
      setError(isBlanks ? 'Fill every gap first.' : 'Type the rest of the query first.')
      return
    }
    setError('')
    try {
      setOutcome(onCheck(buildQuery(question, inputs)))
    } catch (e) {
      // A broken question is a bug in the bank. Do not punish the player for it.
      setError(e instanceof Error ? e.message : 'Something went wrong with this question.')
    }
  }

  // Escape gives up before answering. Tab stays inside the dialog.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !answered) {
      event.stopPropagation()
      onCancel()
      return
    }
    if (event.key !== 'Tab') return
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, textarea, summary') ?? [],
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const correct = outcome?.correct === true

  return (
    <div className="challenge-backdrop">
      <div
        ref={dialogRef}
        className="challenge"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
      >
        <header className="challenge__head">
          <span className="challenge__topic">{question.topic}</span>
          <span className="challenge__lives" aria-label={`${livesLeft} lives left`}>
            {livesLeft} {livesLeft === 1 ? 'life' : 'lives'}
          </span>
        </header>

        <h2 id={titleId} className="challenge__prompt">
          {question.prompt}
        </h2>

        <details className="schema">
          <summary>Tables you can use</summary>
          <ul>
            {schema.map((table) => (
              <li key={table.name}>
                <strong>{table.name}</strong> ({table.columns.join(', ')})
              </li>
            ))}
          </ul>
        </details>

        <form onSubmit={submit}>
          {isBlanks ? (
            <div className="code" aria-label="SQL query with gaps">
              {parts.map((text, i) => (
                <span key={i}>
                  {text}
                  {i < blankCount &&
                    (pickWords ? (
                      <button
                        type="button"
                        className={inputs[i] === '' ? 'slot' : 'slot slot--full'}
                        disabled={answered}
                        onClick={() => setInput(i, '')}
                        aria-label={inputs[i] === '' ? `Gap ${i + 1}, empty` : `Gap ${i + 1}, ${inputs[i]}. Tap to clear`}
                      >
                        {inputs[i] === '' ? ' ' : inputs[i]}
                      </button>
                    ) : (
                      <input
                        className="gap"
                        value={inputs[i]}
                        disabled={answered}
                        onChange={(e) => setInput(i, e.target.value)}
                        size={Math.max(6, inputs[i].length + 1)}
                        spellCheck={false}
                        autoCapitalize="off"
                        autoComplete="off"
                        aria-label={`Gap ${i + 1}`}
                      />
                    ))}
                </span>
              ))}
            </div>
          ) : (
            <div className="code">
              {question.template.trim() !== '' && <div className="code__start">{question.template.trimEnd()}</div>}
              <textarea
                className="complete"
                rows={question.template.trim() === '' ? 3 : 2}
                value={inputs[0]}
                disabled={answered}
                onChange={(e) => setInput(0, e.target.value)}
                onKeyDown={(e) => {
                  // Enter runs the query. Shift and Enter makes a new line.
                  if (e.key === 'Enter' && !e.shiftKey) submit(e)
                }}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                aria-label="Type the rest of the query"
              />
            </div>
          )}

          {pickWords && !answered && (
            <div className="words" role="group" aria-label="Word bank">
              {bank.map((word) => (
                <button key={word} type="button" className="word" onClick={() => addWord(word)}>
                  {word}
                </button>
              ))}
            </div>
          )}

          {error !== '' && (
            <p className="challenge__error" role="alert">
              {error}
            </p>
          )}

          {showHint && !answered && <p className="challenge__hint">Hint: {question.hint}</p>}

          {!answered && (
            <div className="challenge__actions">
              <button type="button" className="btn" onClick={onCancel}>
                Cancel
              </button>
              <button type="button" className="btn btn--hint" onClick={() => setShowHint(true)} disabled={showHint}>
                Hint
              </button>
              <button type="submit" className="btn btn--primary">
                Run query
              </button>
            </div>
          )}
        </form>

        {outcome && (
          <section className={correct ? 'feedback-card feedback-card--ok' : 'feedback-card feedback-card--bad'} aria-live="polite">
            <h3>{correct ? 'Correct' : 'Not quite. You lost a life.'}</h3>
            {correct ? (
              <p>{question.explanation}</p>
            ) : (
              <>
                <p>{outcome.message}</p>
                <p className="feedback-card__label">One correct query:</p>
                <pre className="code code--plain">{question.expectedSql}</pre>
              </>
            )}
            {outcome.playerResult && <ResultTable title="Your result" result={outcome.playerResult} />}
            {!correct && <ResultTable title="Expected result" result={outcome.expectedResult} />}
            <div className="challenge__actions">
              <button ref={continueRef} type="button" className="btn btn--primary" onClick={() => onFinish(correct)}>
                {correct ? 'Fire the arrow' : 'Continue'}
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
