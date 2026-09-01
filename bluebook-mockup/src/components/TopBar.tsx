import { useEffect, useRef, useState } from 'react'
import {
  Accessibility,
  Calculator,
  ChevronDown,
  CircleHelp,
  Highlighter,
  Keyboard,
  LogOut,
  MoreVertical,
  NotebookPen,
  ScanText,
  X,
} from 'lucide-react'
import type { ExamModule } from '../types/exam'

export function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const RW_DIRECTIONS = `The questions in this section are each based on a short passage (or a pair of passages). Read each passage carefully and choose the best answer to the question based on what is stated or implied. Some questions ask you to complete a text with the most logical word, phrase, or transition; others ask you to make a text follow the conventions of Standard English or to use a student's notes to accomplish a writing goal.`

const MATH_DIRECTIONS = `The questions in this section cover algebra, advanced math, problem solving and data analysis, and geometry and trigonometry. For multiple-choice questions, select the single best answer. For student-produced response questions, type your answer into the entry box — entry directions appear beside those questions. A reference sheet of common formulas is available from the toolbar.`

const REFERENCE_ROWS: Array<[string, string]> = [
  ['Area of a circle', 'A = πr²'],
  ['Circumference of a circle', 'C = 2πr'],
  ['Area of a rectangle', 'A = ℓw'],
  ['Area of a triangle', 'A = ½bh'],
  ['Pythagorean theorem', 'a² + b² = c²'],
  ['Slope of a line', 'm = (y₂ − y₁) / (x₂ − x₁)'],
  ['Slope-intercept form', 'y = mx + b'],
  ['Quadratic formula', 'x = (−b ± √(b² − 4ac)) / 2a'],
  ['Angles of a triangle', 'sum = 180°'],
  ['Degrees in a circle', '360°'],
]

interface TopBarProps {
  module: ExamModule
  secondsLeft: number
  hidden: boolean
  onToggleHidden: (hidden: boolean) => void
  onExit: () => void
}

export default function TopBar({ module, secondsLeft, hidden, onToggleHidden, onExit }: TopBarProps) {
  const low = secondsLeft <= 5 * 60
  const isMath = !module.split
  const [directionsOpen, setDirectionsOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [referenceOpen, setReferenceOpen] = useState(false)
  const [toolNote, setToolNote] = useState<string | null>(null)
  const moreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!moreOpen) return
    const close = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [moreOpen])

  useEffect(() => {
    if (!toolNote) return
    const t = window.setTimeout(() => setToolNote(null), 2200)
    return () => window.clearTimeout(t)
  }, [toolNote])

  const moreItems = [
    { label: 'Help', icon: CircleHelp },
    { label: 'Keyboard Shortcuts', icon: Keyboard },
    { label: 'Assistive Technology', icon: Accessibility },
    { label: 'Line Reader', icon: ScanText },
  ]

  return (
    <>
      <header className="relative grid grid-cols-3 items-center border-b border-[#c9cede] bg-[#e8ecf5] px-5 py-2">
        {/* Left: module label + Directions */}
        <div className="min-w-0">
          <p className="truncate text-[19px] font-bold text-[#1c1c1e]">
            {module.label}: {module.title}
          </p>
          <button
            onClick={() => setDirectionsOpen(true)}
            className="mt-0.5 flex items-center gap-1 text-[15px] font-semibold text-[#1c1c1e] hover:text-[#3b4ed8]"
          >
            Directions <ChevronDown size={17} />
          </button>
        </div>

        {/* Center: timer with Hide/Show pill below */}
        <div className="flex flex-col items-center">
          <span
            className={`text-[26px] font-semibold leading-none tabular-nums ${
              low && !hidden ? 'text-[#c62828]' : 'text-[#1c1c1e]'
            }`}
            aria-live="off"
          >
            {hidden ? ' ' : formatTime(secondsLeft)}
          </span>
          <button
            onClick={() => onToggleHidden(!hidden)}
            className="mt-1.5 rounded-full border-[1.5px] border-[#1c1c1e] px-3.5 py-0.5 text-[13px] font-semibold text-[#1c1c1e] hover:bg-white/60"
          >
            {hidden ? 'Show' : 'Hide'}
          </button>
        </div>

        {/* Right: tool buttons */}
        <div className="relative flex items-start justify-end gap-8">
          {!isMath && (
            <button
              onClick={() => setToolNote("Highlighting isn't included in this mockup")}
              className="flex flex-col items-center gap-1 text-[#1c1c1e] hover:text-[#3b4ed8]"
            >
              <span className="flex items-center gap-1">
                <Highlighter size={20} />
                <NotebookPen size={20} />
              </span>
              <span className="text-[13px] font-semibold">Highlights &amp; Notes</span>
            </button>
          )}
          {isMath && (
            <>
              <button
                onClick={() => setToolNote('The calculator is not included in this mockup')}
                className="flex flex-col items-center gap-1 text-[#1c1c1e] hover:text-[#3b4ed8]"
              >
                <Calculator size={20} />
                <span className="text-[13px] font-semibold">Calculator</span>
              </button>
              <button
                onClick={() => setReferenceOpen(true)}
                className="flex flex-col items-center gap-1 text-[#1c1c1e] hover:text-[#3b4ed8]"
              >
                <span className="text-[18px] font-exam-serif italic leading-[20px]">x²</span>
                <span className="text-[13px] font-semibold">Reference</span>
              </button>
            </>
          )}
          <div ref={moreRef} className="relative">
            <button
              onClick={() => setMoreOpen((o) => !o)}
              className="flex flex-col items-center gap-1 text-[#1c1c1e] hover:text-[#3b4ed8]"
            >
              <MoreVertical size={20} />
              <span className="text-[13px] font-semibold">More</span>
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-[#d6d9de] bg-white py-2 shadow-[0_10px_36px_rgba(16,31,60,0.22)]">
                {moreItems.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      setMoreOpen(false)
                      setToolNote(`${item.label} isn't included in this mockup`)
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-[#1c1c1e] hover:bg-[#f4f5f7]"
                  >
                    <item.icon size={17} className="text-[#5b616e]" /> {item.label}
                  </button>
                ))}
                <div className="my-1.5 border-t border-[#e6e8ec]" />
                <button
                  onClick={onExit}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-[#1c1c1e] hover:bg-[#f4f5f7]"
                >
                  <LogOut size={17} className="text-[#5b616e]" /> Save and Exit
                </button>
              </div>
            )}
          </div>

          {toolNote && (
            <div className="absolute right-0 top-full z-50 mt-2 rounded-lg bg-[#1c1c1e] px-3 py-2 text-xs font-semibold text-white shadow-lg">
              {toolNote}
            </div>
          )}
        </div>
      </header>

      {directionsOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/25" onClick={() => setDirectionsOpen(false)} />
          <div className="relative w-full max-w-xl rounded-xl bg-white p-7 shadow-xl">
            <button
              onClick={() => setDirectionsOpen(false)}
              aria-label="Close directions"
              className="absolute right-4 top-4 rounded-full p-1 text-[#5b616e] hover:bg-[#f4f5f7]"
            >
              <X size={18} />
            </button>
            <h2 className="text-lg font-bold text-[#1c1c1e]">
              {module.label}: {module.title} Directions
            </h2>
            <p className="mt-3 font-exam-serif text-[16px] leading-[1.7] text-[#1c1c1e]">
              {isMath ? MATH_DIRECTIONS : RW_DIRECTIONS}
            </p>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setDirectionsOpen(false)}
                className="rounded-full bg-[#f7d54d] px-6 py-2 text-sm font-bold text-[#1c1c1e] hover:bg-[#efc93a]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {referenceOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/25" onClick={() => setReferenceOpen(false)} />
          <div className="relative w-full max-w-lg rounded-xl bg-white p-7 shadow-xl">
            <button
              onClick={() => setReferenceOpen(false)}
              aria-label="Close reference sheet"
              className="absolute right-4 top-4 rounded-full p-1 text-[#5b616e] hover:bg-[#f4f5f7]"
            >
              <X size={18} />
            </button>
            <h2 className="text-lg font-bold text-[#1c1c1e]">Reference</h2>
            <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
              {REFERENCE_ROWS.map(([name, formula]) => (
                <div key={name} className="flex items-baseline justify-between gap-3 border-b border-[#eef0f4] pb-2">
                  <span className="text-sm text-[#3c4048]">{name}</span>
                  <span className="whitespace-nowrap font-exam-serif italic text-[15px] text-[#1c1c1e]">{formula}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
