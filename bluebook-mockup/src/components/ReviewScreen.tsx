import { Bookmark } from 'lucide-react'
import type { ExamModule } from '../types/exam'

interface ReviewScreenProps {
  module: ExamModule
  answers: Record<string, string>
  flags: Record<string, boolean>
  secondsLeft: number
  onJump: (index: number) => void
  onBackToTest: () => void
  onSubmit: () => void
}

export default function ReviewScreen({
  module,
  answers,
  flags,
  onJump,
  onBackToTest,
  onSubmit,
}: ReviewScreenProps) {
  return (
    <div className="flex h-screen flex-col bg-[#f4f5f7] text-[#1c1c1e]">
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-6 py-12">
          <h1 className="text-center text-[28px] font-bold">Check Your Work</h1>
          <p className="mt-4 text-center text-[15px] leading-relaxed text-[#3c4048]">
            On test day, you won't be able to move on to the next module until time expires.
          </p>
          <p className="mt-1 text-center text-[15px] leading-relaxed text-[#3c4048]">
            For these practice questions, you can click <strong className="font-bold text-[#1c1c1e]">Next</strong> when
            you're ready to move on.
          </p>

          <div className="mx-auto mt-8 max-w-2xl rounded-xl border border-[#d6d9de] bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[15px] font-bold">
                {module.label}: {module.title}
              </p>
              <div className="flex items-center gap-5 text-xs font-semibold text-[#3c4048]">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3.5 w-3.5 rounded-[3px] border-2 border-dashed border-[#9aa1ad] bg-white" />
                  Unanswered
                </span>
                <span className="flex items-center gap-1.5">
                  <Bookmark size={13} className="fill-[#c62828] text-[#c62828]" /> For Review
                </span>
              </div>
            </div>

            <div className="my-4 border-t border-[#e6e8ec]" />

            <div className="flex flex-wrap gap-x-2.5 gap-y-3">
              {module.questions.map((q, i) => {
                const answered = (answers[q.id] ?? '').trim() !== ''
                const flagged = !!flags[q.id]
                return (
                  <span key={q.id} className="relative">
                    <button
                      onClick={() => onJump(i)}
                      aria-label={`Question ${i + 1}${answered ? ', answered' : ', unanswered'}${flagged ? ', marked for review' : ''}`}
                      className={`flex h-10 w-10 items-center justify-center rounded-[5px] text-[15px] font-bold ${
                        answered
                          ? 'bg-[#3b4ed8] text-white'
                          : 'border-2 border-dashed border-[#9aa1ad] bg-white text-[#3b4ed8] hover:border-[#3b4ed8]'
                      }`}
                    >
                      {i + 1}
                    </button>
                    {flagged && (
                      <Bookmark
                        size={13}
                        aria-hidden="true"
                        className="absolute -right-1 -top-1.5 fill-[#c62828] text-[#c62828]"
                      />
                    )}
                  </span>
                )
              })}
            </div>
          </div>
        </div>
      </main>

      <footer className="flex items-center justify-between gap-4 border-t border-[#c9cede] bg-[#e8ecf5] px-6 py-3">
        <div className="flex-1">
          <p className="truncate text-[17px] font-bold text-[#1c1c1e]">Conan Yi</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={onBackToTest}
            className="rounded-full bg-[#3b4ed8] px-7 py-2.5 text-[15px] font-semibold text-white hover:bg-[#2f3fb8]"
          >
            Back
          </button>
          <button
            onClick={onSubmit}
            className="rounded-full bg-[#3b4ed8] px-7 py-2.5 text-[15px] font-semibold text-white hover:bg-[#2f3fb8]"
          >
            Next
          </button>
        </div>
      </footer>
    </div>
  )
}
