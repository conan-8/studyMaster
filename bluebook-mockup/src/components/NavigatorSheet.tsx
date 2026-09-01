import { Bookmark, MapPin, X } from 'lucide-react'
import type { ExamModule } from '../types/exam'

interface NavigatorSheetProps {
  open: boolean
  module: ExamModule
  current: number
  answers: Record<string, string>
  flags: Record<string, boolean>
  onClose: () => void
  onJump: (index: number) => void
  onReview: () => void
}

export default function NavigatorSheet({
  open,
  module,
  current,
  answers,
  flags,
  onClose,
  onJump,
  onReview,
}: NavigatorSheetProps) {
  if (!open) return null

  return (
    <>
      {/* Transparent click-catcher — no dimming, panel floats above the bottom bar */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-[64px] z-50 flex justify-center px-4">
        <div className="relative w-full max-w-xl">
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[74vh] overflow-y-auto rounded-xl border border-[#d6d9de] bg-white px-6 py-5 shadow-[0_10px_36px_rgba(16,31,60,0.25)]"
          >
            <button
              onClick={onClose}
              aria-label="Close question navigator"
              className="absolute right-3.5 top-3.5 rounded-full p-1 text-[#3c4048] hover:bg-[#f4f5f7]"
            >
              <X size={19} />
            </button>

            <p className="text-center text-[18px] font-bold leading-snug text-[#1c1c1e]">
              {module.label}:
              <br />
              {module.title} Questions
            </p>

            <div className="mt-4 flex items-center justify-center gap-7 text-[13px] font-semibold text-[#3c4048]">
              <span className="flex items-center gap-1.5">
                <MapPin size={15} className="fill-[#1c1c1e] text-[#1c1c1e]" /> Current
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-4 w-4 rounded-[3px] border-2 border-dashed border-[#9aa1ad] bg-white" />
                Unanswered
              </span>
              <span className="flex items-center gap-1.5">
                <Bookmark size={14} className="fill-[#c62828] text-[#c62828]" /> For Review
              </span>
            </div>

            <div className="mt-5 flex flex-wrap justify-center gap-x-2.5 gap-y-4">
              {module.questions.map((q, i) => {
                const answered = (answers[q.id] ?? '').trim() !== ''
                const flagged = !!flags[q.id]
                const isCurrent = i === current
                return (
                  <span key={q.id} className="relative">
                    {isCurrent && (
                      <MapPin
                        size={17}
                        aria-hidden="true"
                        className="absolute -top-4 left-1/2 -translate-x-1/2 fill-[#1c1c1e] text-[#1c1c1e]"
                      />
                    )}
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

            <div className="mt-6 flex justify-center pb-1">
              <button
                onClick={onReview}
                className="rounded-full border-2 border-[#3b4ed8] bg-white px-8 py-2.5 text-sm font-bold text-[#3b4ed8] hover:bg-[#eef1fc]"
              >
                Go to Review Page
              </button>
            </div>
          </div>

          {/* Pointer toward the "Question X of Y" pill */}
          <span
            aria-hidden="true"
            className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-[#d6d9de] bg-white"
          />
        </div>
      </div>
    </>
  )
}
