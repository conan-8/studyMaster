import { useEffect, useState } from 'react'
import StartScreen from '../components/StartScreen'
import ExamScreen from '../components/ExamScreen'
import ReviewScreen from '../components/ReviewScreen'
import TransitionScreen from '../components/TransitionScreen'
import BreakScreen from '../components/BreakScreen'
import ResultsScreen from '../components/ResultsScreen'
import IntroScreen from '../components/IntroScreen'
import { assembleTest, fetchBank, selectQuestions, type BankQuestion, type SourceKind } from '../data/live'
import type { ExamModule } from '../types/exam'

type Screen = 'start' | 'intro' | 'exam' | 'review' | 'transition' | 'break' | 'results'

// The 10-minute break sits between Section 1 (Reading and Writing) and Section 2 (Math).
const BREAK_BEFORE_MODULE = 2

export default function Home() {
  const [screen, setScreen] = useState<Screen>('start')
  const [test, setTest] = useState<ExamModule[]>([])
  const [counts, setCounts] = useState<{ generated: number; bank: number; bluebook: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingStart, setPendingStart] = useState<{ source: SourceKind; excludeBluebook: boolean } | null>(null)
  const [moduleIdx, setModuleIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [flags, setFlags] = useState<Record<string, boolean>>({})
  const [crossed, setCrossed] = useState<Record<string, string[]>>({})
  const [index, setIndex] = useState(0)
  const [secondsLeft, setSecondsLeft] = useState(0)

  // Load the live bank once for the start-screen counts.
  useEffect(() => {
    let cancelled = false
    fetchBank()
      .then((bank) => {
        if (cancelled) return
        const harvested = bank.harvested
        setCounts({
          generated: bank.generated.length,
          bank: harvested.filter((q: BankQuestion) => q.kind === 'bank').length,
          bluebook: harvested.filter((q: BankQuestion) => q.kind === 'bluebook').length,
        })
        setError(null)
      })
      .catch((err) => !cancelled && setError(`Could not reach the question bank: ${String(err)}`))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  const module = test[moduleIdx]
  const isLastModule = moduleIdx === test.length - 1
  const running = (screen === 'exam' || screen === 'review') && module !== undefined

  useEffect(() => {
    if (!running) return
    const t = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearInterval(t)
  }, [running])

  // Time expired: auto-advance to the transition screen (or submit on the last module).
  useEffect(() => {
    if (!running || secondsLeft !== 0) return
    setScreen(isLastModule ? 'results' : 'transition')
  }, [running, secondsLeft, isLastModule])

  const beginModule = (i: number) => {
    setModuleIdx(i)
    setIndex(0)
    setSecondsLeft(test[i]!.minutes * 60)
    setScreen('exam')
  }

  const startTest = (source: SourceKind, excludeBluebook: boolean) => {
    setPendingStart({ source, excludeBluebook })
    fetchBank()
      .then((bank) => {
        const assembled = assembleTest(selectQuestions(bank, source, excludeBluebook))
        if (assembled.length === 0) {
          setError('No questions available for that source.')
          return
        }
        setTest(assembled)
        setAnswers({})
        setFlags({})
        setCrossed({})
        setError(null)
        setScreen('intro')
      })
      .catch((err) => setError(`Could not load questions: ${String(err)}`))
      .finally(() => setPendingStart(null))
  }

  const submitModule = () => {
    setScreen(isLastModule ? 'results' : 'transition')
  }

  // After the "This Module Is Over" screen: break before Math, otherwise straight to the next module.
  const advanceAfterTransition = () => {
    const next = moduleIdx + 1
    if (next === BREAK_BEFORE_MODULE && test.length > BREAK_BEFORE_MODULE) setScreen('break')
    else if (next < test.length) beginModule(next)
    else setScreen('results')
  }

  const handleAnswer = (questionId: string, value: string) =>
    setAnswers((prev) => ({ ...prev, [questionId]: value }))

  const handleToggleFlag = (questionId: string) =>
    setFlags((prev) => ({ ...prev, [questionId]: !prev[questionId] }))

  const handleToggleCross = (questionId: string, letter: string) =>
    setCrossed((prev) => {
      const list = prev[questionId] ?? []
      return {
        ...prev,
        [questionId]: list.includes(letter) ? list.filter((l) => l !== letter) : [...list, letter],
      }
    })

  const jumpTo = (i: number) => {
    setIndex(i)
    setScreen('exam')
  }

  const exitToStart = () => setScreen('start')

  if (screen === 'start') {
    return (
      <StartScreen
        onStart={startTest}
        counts={counts}
        loading={loading || pendingStart !== null}
        error={error}
      />
    )
  }

  if (screen === 'intro') {
    return <IntroScreen onDone={() => beginModule(0)} />
  }

  if (screen === 'exam') {
    return (
      <ExamScreen
        module={module}
        index={index}
        answers={answers}
        flags={flags}
        crossed={crossed}
        secondsLeft={secondsLeft}
        onAnswer={handleAnswer}
        onToggleFlag={handleToggleFlag}
        onToggleCross={handleToggleCross}
        onNavigate={setIndex}
        onReview={() => setScreen('review')}
        onExit={exitToStart}
      />
    )
  }

  if (screen === 'review') {
    return (
      <ReviewScreen
        module={module}
        answers={answers}
        flags={flags}
        secondsLeft={secondsLeft}
        onJump={jumpTo}
        onBackToTest={() => setScreen('exam')}
        onSubmit={submitModule}
      />
    )
  }

  if (screen === 'transition') {
    return <TransitionScreen onContinue={advanceAfterTransition} />
  }

  if (screen === 'break') {
    return <BreakScreen onResume={() => beginModule(BREAK_BEFORE_MODULE)} />
  }

  return <ResultsScreen onExit={exitToStart} />
}
