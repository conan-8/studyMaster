import { useState } from 'react'
import type { ExamModule } from '../types/exam'
import TopBar from './TopBar'
import BottomBar from './BottomBar'
import QuestionView from './QuestionView'
import NavigatorSheet from './NavigatorSheet'

interface ExamScreenProps {
  module: ExamModule
  index: number
  answers: Record<string, string>
  flags: Record<string, boolean>
  crossed: Record<string, string[]>
  secondsLeft: number
  onAnswer: (questionId: string, value: string) => void
  onToggleFlag: (questionId: string) => void
  onToggleCross: (questionId: string, letter: string) => void
  onNavigate: (index: number) => void
  onReview: () => void
  onExit: () => void
}

export default function ExamScreen({
  module,
  index,
  answers,
  flags,
  crossed,
  secondsLeft,
  onAnswer,
  onToggleFlag,
  onToggleCross,
  onNavigate,
  onReview,
  onExit,
}: ExamScreenProps) {
  const [navOpen, setNavOpen] = useState(false)
  const [timerHidden, setTimerHidden] = useState(false)
  const question = module.questions[index]

  return (
    <div className="flex h-screen flex-col bg-[#f4f5f7] text-[#1c1c1e]">
      <TopBar
        module={module}
        secondsLeft={secondsLeft}
        hidden={timerHidden}
        onToggleHidden={setTimerHidden}
        onExit={onExit}
      />

      <div className="bg-[#e8ecf5] px-4 pb-2.5 pt-1.5">
        <div className="rounded-2xl bg-[#1e2350] py-2.5 text-center text-[15px] font-bold tracking-wide text-white">
          THIS IS A PRACTICE TEST
        </div>
      </div>

      <main className="flex-1 overflow-hidden bg-white">
        <QuestionView
          module={module}
          question={question}
          number={index + 1}
          answer={answers[question.id]}
          flagged={!!flags[question.id]}
          crossed={crossed[question.id] ?? []}
          onAnswer={onAnswer}
          onToggleFlag={onToggleFlag}
          onToggleCross={onToggleCross}
        />
      </main>

      <BottomBar
        index={index}
        total={module.questions.length}
        navOpen={navOpen}
        onToggleNavigator={() => setNavOpen((o) => !o)}
        onBack={() => onNavigate(Math.max(0, index - 1))}
        onNext={() => {
          if (index === module.questions.length - 1) onReview()
          else onNavigate(index + 1)
        }}
      />

      <NavigatorSheet
        open={navOpen}
        module={module}
        current={index}
        answers={answers}
        flags={flags}
        onClose={() => setNavOpen(false)}
        onJump={(i) => {
          onNavigate(i)
          setNavOpen(false)
        }}
        onReview={() => {
          setNavOpen(false)
          onReview()
        }}
      />
    </div>
  )
}
