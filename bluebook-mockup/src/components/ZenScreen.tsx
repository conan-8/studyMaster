import { useEffect, useMemo, useRef, useState } from 'react'
import { LogOut } from 'lucide-react'
import { useSearchParams } from 'react-router'
import type { BankQuestion, ZenDifficulty, ZenSubject } from '../data/live'
import { fetchBank, isCorrect, postEvents, selectBySkills, selectZen } from '../data/live'
import QuestionView from './QuestionView'
import RichText from './RichText'
import { formatTime } from './TopBar'

type TimerOpt = 0 | 60 | 90 | 120

interface ZenConfig {
  subject: ZenSubject
  difficulty: ZenDifficulty
  timer: TimerOpt
}

interface SessionEntry {
  q: BankQuestion
  chosen?: string
  correct: boolean | null
  checked: boolean
}

const SUBJECTS: Array<{ id: ZenSubject; label: string }> = [
  { id: 'all', label: 'All subjects' },
  { id: 'math', label: 'Math' },
  { id: 'rw', label: 'Reading & Writing' },
]
const DIFFS: Array<{ id: ZenDifficulty; label: string; blurb: string }> = [
  { id: 'chill', label: 'Chill', blurb: 'Easy items only' },
  { id: 'standard', label: 'Standard', blurb: 'The full mix' },
  { id: 'brutal', label: 'Brutal', blurb: 'Hard items only' },
]
const TIMERS: Array<{ id: TimerOpt; label: string }> = [
  { id: 0, label: 'Off' },
  { id: 60, label: '1:00' },
  { id: 90, label: '1:30' },
  { id: 120, label: '2:00' },
]

function shuffle<T>(list: T[]): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

interface SetupProps {
  config: ZenConfig
  onConfig: (c: ZenConfig) => void
  onStart: () => void
  onExit: () => void
  counts: Record<ZenDifficulty, number> | null
}

function ZenSetup({ config, onConfig, onStart, onExit, counts }: SetupProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[#f4f5f7] text-[#1c1c1e]">
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-xl">
          <h1 className="text-center text-[30px] font-bold">Zen mode</h1>
          <p className="mt-2 text-center text-sm text-[#5b616e]">
            An endless stream of questions. No lock screen, no exam timer — check as you go and read the rationale.
          </p>

          <div className="mt-8 rounded-2xl border border-[#d6d9de] bg-white px-8 py-6 shadow-sm">
            <p className="text-[15px] font-bold">Subject</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {SUBJECTS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onConfig({ ...config, subject: s.id })}
                  className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
                    config.subject === s.id
                      ? 'border-[#3b4ed8] bg-[#eef0fd] text-[#3b4ed8]'
                      : 'border-[#d6d9de] bg-white text-[#3c4048] hover:border-[#9aa1ad]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <p className="mt-5 text-[15px] font-bold">Difficulty</p>
            <div className="mt-2.5 grid gap-2.5">
              {DIFFS.map((d) => (
                <button
                  key={d.id}
                  onClick={() => onConfig({ ...config, difficulty: d.id })}
                  className={`flex items-center justify-between rounded-xl border px-4 py-2.5 text-left transition-colors ${
                    config.difficulty === d.id
                      ? 'border-[#3b4ed8] bg-[#eef0fd]'
                      : 'border-[#d6d9de] bg-white hover:border-[#9aa1ad]'
                  }`}
                >
                  <span>
                    <span className="block text-sm font-bold">{d.label}</span>
                    <span className="mt-0.5 block text-xs text-[#3c4048]">{d.blurb}</span>
                  </span>
                  <span className="text-xs font-semibold tabular-nums text-[#5b616e]">
                    {counts ? `${counts[d.id]} items` : '…'}
                  </span>
                </button>
              ))}
            </div>

            <p className="mt-5 text-[15px] font-bold">Per-question timer</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {TIMERS.map((t) => (
                <button
                  key={t.id}
                  onClick={() => onConfig({ ...config, timer: t.id })}
                  className={`rounded-full border px-4 py-1.5 text-sm font-semibold tabular-nums transition-colors ${
                    config.timer === t.id
                      ? 'border-[#3b4ed8] bg-[#eef0fd] text-[#3b4ed8]'
                      : 'border-[#d6d9de] bg-white text-[#3c4048] hover:border-[#9aa1ad]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-[#8a8f99]">
              The timer only shows your pace — it never locks you out or advances for you.
            </p>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2.5">
            <button
              onClick={onExit}
              className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-[#3c4048] ring-1 ring-[#d6d9de] hover:bg-[#f4f5f7]"
            >
              Back to Looseleaf
            </button>
            <button
              onClick={onStart}
              disabled={counts !== null && counts[config.difficulty] === 0}
              className="rounded-full bg-[#3b4ed8] px-7 py-2 text-sm font-semibold text-white hover:bg-[#2f3fb8] disabled:opacity-40"
            >
              Start session
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function ZenScreen() {
  const [phase, setPhase] = useState<'setup' | 'run' | 'report'>('setup')
  const [config, setConfig] = useState<ZenConfig>({ subject: 'all', difficulty: 'standard', timer: 0 })
  const [bank, setBank] = useState<Awaited<ReturnType<typeof fetchBank>> | null>(null)
  const [loading, setLoading] = useState(true)

  const [queue, setQueue] = useState<BankQuestion[]>([])
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [crossed, setCrossed] = useState<Record<string, string[]>>({})
  const [revealed, setRevealed] = useState(false)
  const [lastRight, setLastRight] = useState<boolean | null>(null)

  const [answered, setAnswered] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [run, setRun] = useState(0)
  const [bestRun, setBestRun] = useState(0)

  const [sessionLog, setSessionLog] = useState<SessionEntry[]>([])
  const postedRef = useRef<Set<string>>(new Set())

  const [secondsLeft, setSecondsLeft] = useState(0)
  const lastIdRef = useRef<string | null>(null)
  const shownAtRef = useRef<number>(0)
  const [searchParams] = useSearchParams()
  const retryId = searchParams.get('retry')
  const skillsList = useMemo(() => {
    const raw = searchParams.get('skills')
    return raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : []
  }, [searchParams])

  useEffect(() => {
    let cancelled = false
    fetchBank()
      .then((b) => {
        if (cancelled) return
        setBank(b)
        // Entering via "RETRY" from Mistakes: jump straight into a run with
        // that question served first.
        if (retryId) {
          const target = [...b.generated, ...b.harvested].find((q) => q.id === retryId)
          if (target) {
            const rest = shuffle(
              selectZen(b, 'all', 'standard').filter((q) => q.id !== retryId),
            )
            setQueue([target, ...rest])
            setSecondsLeft(0)
            shownAtRef.current = Date.now()
            setPhase('run')
          }
          return
        }
        // Entering via a skill drill from the looseleaf skill map.
        if (skillsList.length > 0) {
          const pool = shuffle(selectBySkills(b, skillsList))
          if (pool.length > 0) {
            setQueue(pool)
            setSecondsLeft(0)
            shownAtRef.current = Date.now()
            setPhase('run')
          }
        }
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [retryId, skillsList])

  const counts = useMemo(() => {
    if (!bank) return null
    return {
      chill: selectZen(bank, config.subject, 'chill').length,
      standard: selectZen(bank, config.subject, 'standard').length,
      brutal: selectZen(bank, config.subject, 'brutal').length,
    }
  }, [bank, config.subject])

  const question = queue[index]

  const start = () => {
    if (!bank) return
    const pool = shuffle(selectZen(bank, config.subject, config.difficulty))
    setQueue(pool)
    setIndex(0)
    setAnswers({})
    setCrossed({})
    setRevealed(false)
    setLastRight(null)
    setAnswered(0)
    setCorrectCount(0)
    setRun(0)
    setBestRun(0)
    setSessionLog([])
    postedRef.current = new Set()
    lastIdRef.current = null
    shownAtRef.current = Date.now()
    setSecondsLeft(config.timer)
    setPhase('run')
  }

  // Grade the current question, post its event once, and append it to the
  // session log (used by the exit report). Called on Next and on Finish.
  const leaveCurrent = () => {
    if (!question) return
    const chosen = answers[question.id]
    const hasAnswer = !!chosen && chosen.trim() !== ''
    const correct = hasAnswer ? isCorrect(question, chosen!) : null
    if (hasAnswer && !postedRef.current.has(question.id)) {
      postedRef.current.add(question.id)
      postEvents([
        {
          question_id: question.id,
          correct: correct!,
          mode: 'practice',
          time_ms: Date.now() - shownAtRef.current,
          choice_id: question.options ? chosen : undefined,
          grid_in_answer: question.options ? undefined : chosen,
        },
      ]).catch(() => {})
    }
    setSessionLog((log) => [...log, { q: question, chosen, correct, checked: revealed }])
  }

  const finish = () => {
    leaveCurrent()
    setPhase('report')
  }

  // Per-question countdown (pace only). Resets whenever the question changes.
  useEffect(() => {
    if (phase !== 'run' || config.timer === 0 || revealed) return
    const t = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearInterval(t)
  }, [phase, config.timer, revealed, index])

  const answer = question ? answers[question.id] : undefined

  const canCheck =
    !!question && !revealed && (question.options ? !!answer : !!answer && answer.trim() !== '')

  const check = () => {
    if (!question || !canCheck) return
    const right = isCorrect(question, answer ?? '')
    setRevealed(true)
    setLastRight(right)
    setAnswered((n) => n + 1)
    if (right) {
      setCorrectCount((n) => n + 1)
      setRun((r) => {
        const next = r + 1
        setBestRun((b) => Math.max(b, next))
        return next
      })
    } else {
      setRun(0)
    }
  }

  const next = () => {
    leaveCurrent()
    lastIdRef.current = question?.id ?? null
    shownAtRef.current = Date.now()
    setSecondsLeft(config.timer)
    setRevealed(false)
    setLastRight(null)
    setIndex((i) => {
      const ni = i + 1
      if (ni >= queue.length) {
        let reshuffled = shuffle(queue)
        if (reshuffled.length > 1 && reshuffled[0]!.id === lastIdRef.current) {
          reshuffled = [...reshuffled.slice(1), reshuffled[0]!]
        }
        setQueue(reshuffled)
        return 0
      }
      return ni
    })
  }

  if (phase === 'setup') {
    return (
      <ZenSetup
        config={config}
        onConfig={setConfig}
        onStart={start}
        onExit={() => {
          window.location.href = './index.html#zen'
        }}
        counts={loading ? null : counts}
      />
    )
  }

  if (phase === 'report') {
    const right = sessionLog.filter((e) => e.correct === true).length
    const wrong = sessionLog.filter((e) => e.correct === false).length
    const skipped = sessionLog.filter((e) => e.correct === null).length
    const acc = right + wrong > 0 ? Math.round((right / (right + wrong)) * 100) : 0
    return (
      <div className="min-h-screen bg-[#f4f5f7] text-[#1c1c1e]">
        <main className="mx-auto max-w-3xl px-6 py-12">
          <h1 className="text-center text-[30px] font-bold">Session report</h1>
          <p className="mt-2 text-center text-sm text-[#5b616e]">
            {sessionLog.length} questions · {right} right · {wrong} wrong · {skipped} skipped · {acc}%
          </p>

          <div className="mt-8 overflow-hidden rounded-2xl border border-[#d6d9de] bg-white shadow-sm">
            {sessionLog.length === 0 && (
              <p className="px-8 py-10 text-center text-sm text-[#8a8f99]">No questions this session.</p>
            )}
            {sessionLog.map((e, i) => (
              <div key={e.q.id + i} className="flex items-start gap-4 border-b border-[#eef0f4] px-6 py-4 last:border-b-0">
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[14px] font-bold text-white ${
                    e.correct === true ? 'bg-[#2e7d32]' : e.correct === false ? 'bg-[#c62828]' : 'bg-[#9aa1ad]'
                  }`}
                >
                  {e.correct === true ? '✓' : e.correct === false ? '✗' : '–'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[1.2px] text-[#8a8f99]">
                    {i + 1} · {e.q.archetype}
                    {e.checked ? '' : ' · not checked'}
                  </p>
                  <p className="mt-1 truncate font-exam-serif text-[15px] text-[#1c1c1e]">{e.q.prompt}</p>
                  <p className="mt-1 text-[13px] text-[#5b616e]">
                    {e.correct === null ? (
                      'Skipped — no answer.'
                    ) : (
                      <>
                        Your answer:{' '}
                        <b className={e.correct ? 'text-[#1b5e20]' : 'text-[#b71c1c]'}>{e.chosen || '—'}</b>
                        {!e.correct && <> · Correct: <b className="text-[#1b5e20]">{e.q.correct}</b></>}
                      </>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-center gap-2.5">
            <button
              onClick={() => window.location.assign('./index.html#zen')}
              className="rounded-full bg-white px-6 py-2 text-sm font-semibold text-[#3c4048] ring-1 ring-[#d6d9de] hover:bg-[#f4f5f7]"
            >
              Back to Looseleaf
            </button>
            <button
              onClick={() => {
                setSessionLog([])
                setPhase('setup')
              }}
              className="rounded-full bg-[#3b4ed8] px-7 py-2 text-sm font-semibold text-white hover:bg-[#2f3fb8]"
            >
              New session
            </button>
          </div>
        </main>
      </div>
    )
  }

  if (!question) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f5f7] text-[#5b616e]">
        {loading ? 'Loading questions…' : 'No questions match this configuration.'}
      </div>
    )
  }

  const module = {
    id: 'zen',
    label: 'Zen mode',
    title: SUBJECTS.find((s) => s.id === config.subject)?.label ?? 'All subjects',
    minutes: 0,
    split: question.section === 'rw',
    questions: queue,
  }

  const acc = answered > 0 ? Math.round((correctCount / answered) * 100) : 100

  return (
    <div className="flex h-screen flex-col bg-[#f4f5f7] text-[#1c1c1e]">
      <header className="relative grid grid-cols-3 items-center border-b border-[#c9cede] bg-[#e8ecf5] px-5 py-2">
        <div className="min-w-0">
          <p className="truncate text-[19px] font-bold text-[#1c1c1e]">
            {module.label}: {module.title}
          </p>
          <span className="mt-0.5 inline-block rounded-full bg-[#1e2350] px-3 py-0.5 text-[12px] font-bold tracking-wide text-white">
            ZEN MODE
          </span>
          {retryId && question.id === retryId && (
            <span className="mt-0.5 ml-2 inline-block rounded-full bg-[#c62828] px-3 py-0.5 text-[12px] font-bold tracking-wide text-white">
              DRILLING A MISTAKE
            </span>
          )}
          {skillsList.length > 0 && (
            <span className="mt-0.5 ml-2 inline-block rounded-full bg-[#3b4ed8] px-3 py-0.5 text-[12px] font-bold tracking-wide text-white">
              DRILLING: {skillsList[0]}
              {skillsList.length > 1 ? ` +${skillsList.length - 1}` : ''}
            </span>
          )}
        </div>

        <div className="flex flex-col items-center">
          {config.timer > 0 ? (
            <span
              className={`text-[26px] font-semibold leading-none tabular-nums ${
                secondsLeft === 0 ? 'text-[#c62828]' : 'text-[#1c1c1e]'
              }`}
            >
              {formatTime(secondsLeft)}
            </span>
          ) : (
            <span className="text-[26px] font-semibold leading-none text-[#1c1c1e]">∞</span>
          )}
          <span className="mt-1 text-[12px] font-semibold tabular-nums text-[#5b616e]">
            run {run} ✓ · best {bestRun} · {acc}%
          </span>
        </div>

        <div className="flex items-start justify-end">
          <button
            onClick={finish}
            className="flex flex-col items-center gap-1 text-[#1c1c1e] hover:text-[#3b4ed8]"
          >
            <LogOut size={20} />
            <span className="text-[13px] font-semibold">Finish</span>
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden bg-white">
        <QuestionView
          module={module}
          question={question}
          number={index + 1}
          answer={answer}
          flagged={false}
          crossed={crossed[question.id] ?? []}
          onAnswer={(id, v) => setAnswers((p) => ({ ...p, [id]: v }))}
          onToggleFlag={() => {}}
          onToggleCross={(id, letter) =>
            setCrossed((p) => {
              const list = p[id] ?? []
              return { ...p, [id]: list.includes(letter) ? list.filter((l) => l !== letter) : [...list, letter] }
            })
          }
          reveal={revealed}
          hideFlag
        />
      </main>

      {revealed && (
        <div className="max-h-[38vh] overflow-y-auto border-t border-[#c9cede] bg-white px-6 py-4">
          <div
            className={`mx-auto max-w-[780px] rounded-lg px-4 py-3 ${
              lastRight ? 'bg-[#e8f5e9]' : 'bg-[#fdecea]'
            }`}
          >
            <p className={`text-[15px] font-bold ${lastRight ? 'text-[#1b5e20]' : 'text-[#b71c1c]'}`}>
              {lastRight ? '✓ Correct — nice.' : `✗ Not quite. Correct answer: ${question.correct}`}
            </p>
            {question.rationale ? (
              <RichText
                text={question.rationale}
                className="mt-2 block font-exam-serif text-[15px] leading-[1.7] text-[#1c1c1e]"
              />
            ) : (
              <p className="mt-2 font-exam-serif text-[15px] italic text-[#5b616e]">No rationale for this one yet.</p>
            )}
          </div>
        </div>
      )}

      <footer className="flex items-center justify-between gap-4 border-t border-[#c9cede] bg-[#e8ecf5] px-6 py-3">
        <div className="flex-1">
          <p className="truncate text-[15px] font-semibold tabular-nums text-[#3c4048]">
            {answered} answered · {correctCount} right
          </p>
        </div>

        <span className="rounded-full bg-[#1c1c1e] px-6 py-2.5 text-[15px] font-semibold text-white">
          Question {index + 1}
        </span>

        <div className="flex flex-1 items-center justify-end gap-2.5">
          <button
            onClick={check}
            disabled={!canCheck}
            className="rounded-full bg-white px-6 py-2.5 text-[15px] font-semibold text-[#3b4ed8] ring-1 ring-[#3b4ed8] hover:bg-[#eef0fd] disabled:opacity-40 disabled:ring-[#d6d9de] disabled:text-[#9aa1ad]"
          >
            Check
          </button>
          <button
            onClick={next}
            className="rounded-full bg-[#3b4ed8] px-7 py-2.5 text-[15px] font-semibold text-white hover:bg-[#2f3fb8]"
          >
            Next →
          </button>
        </div>
      </footer>
    </div>
  )
}
