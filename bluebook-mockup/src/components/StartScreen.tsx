import { useState } from 'react'
import { BarChart3, Clock3, Database, LockOpen, PersonStanding } from 'lucide-react'
import type { SourceKind } from '../data/live'

interface StartScreenProps {
  onStart: (source: SourceKind, excludeBluebook: boolean) => void
  counts: { generated: number; bank: number; bluebook: number } | null
  loading: boolean
  error: string | null
}

const INFO_ROWS = [
  {
    icon: Clock3,
    title: 'Timing',
    body: 'This practice test is timed like the real thing. Each module has its own countdown clock at the top of the screen, and you can hide it if it distracts you.',
  },
  {
    icon: BarChart3,
    title: 'Scores',
    body: "This mockup doesn't score your test and doesn't show an answer key when you finish.",
  },
  {
    icon: PersonStanding,
    title: 'Assistive Technology (AT)',
    body: 'The real testing app works with assistive technology. This mockup keeps the look and flow, but not every tool is included.',
  },
  {
    icon: LockOpen,
    title: 'No Device Lock',
    body: 'This practice build runs in your browser and does not lock your device the way the real exam does.',
  },
]

const SOURCES: Array<{ kind: SourceKind; label: string; blurb: string }> = [
  { kind: 'generated', label: 'Generated', blurb: 'Original questions written by the studyMaste generator' },
  { kind: 'bank', label: 'Question Bank', blurb: 'Items from the online College Board question bank' },
  { kind: 'bluebook', label: 'Bluebook', blurb: 'Bank items that appear in Bluebook practice exams' },
]

export default function StartScreen({ onStart, counts, loading, error }: StartScreenProps) {
  const [source, setSource] = useState<SourceKind>('generated')
  const [excludeBluebook, setExcludeBluebook] = useState(false)
  const count = counts ? counts[source] : null
  const empty = counts !== null && count === 0

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f5f7] text-[#1c1c1e]">
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          <h1 className="text-center text-[30px] font-bold">Practice Test</h1>

          <div className="mt-8 rounded-2xl border border-[#d6d9de] bg-white px-8 py-6 shadow-sm">
            <div className="flex items-center gap-2.5">
              <Database size={18} className="text-[#3b4ed8]" />
              <p className="text-[15px] font-bold">Question source</p>
            </div>
            <div className="mt-4 grid gap-2.5">
              {SOURCES.map((s) => {
                const active = source === s.kind
                const n = counts ? counts[s.kind] : null
                return (
                  <button
                    key={s.kind}
                    onClick={() => setSource(s.kind)}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                      active ? 'border-[#3b4ed8] bg-[#eef0fd]' : 'border-[#d6d9de] bg-white hover:border-[#9aa1ad]'
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-bold">{s.label}</span>
                      <span className="mt-0.5 block text-xs text-[#3c4048]">{s.blurb}</span>
                    </span>
                    <span className="ml-4 shrink-0 text-xs font-semibold tabular-nums text-[#5b616e]">
                      {loading ? '…' : n === null ? '' : `${n} items`}
                    </span>
                  </button>
                )
              })}
            </div>
            <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-sm text-[#3c4048]">
              <input
                type="checkbox"
                checked={excludeBluebook}
                onChange={(e) => setExcludeBluebook(e.target.checked)}
                className="h-4 w-4 accent-[#3b4ed8]"
              />
              Exclude Bluebook questions from any mixed view
            </label>
            {empty && (
              <p className="mt-4 rounded-lg bg-[#fdf3f2] px-4 py-2.5 text-sm text-[#a13a32]">
                No {SOURCES.find((s) => s.kind === source)?.label} questions in the bank yet — pick another source.
              </p>
            )}
            {error && (
              <p className="mt-4 rounded-lg bg-[#fdf3f2] px-4 py-2.5 text-sm text-[#a13a32]">{error}</p>
            )}
          </div>

          <div className="mt-5 rounded-2xl border border-[#d6d9de] bg-white px-8 py-4 shadow-sm">
            {INFO_ROWS.map((row) => (
              <div key={row.title} className="flex items-start gap-5 border-b border-[#eef0f4] py-5 last:border-b-0">
                <row.icon size={26} className="mt-1 shrink-0 text-[#3b4ed8]" />
                <div>
                  <p className="text-[15px] font-bold">{row.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-[#3c4048]">{row.body}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-xs leading-relaxed text-[#8a8f99]">
            Unofficial mockup with original sample items. Not affiliated with or endorsed by the College Board.
          </p>
        </div>
      </main>

      <footer className="flex items-center justify-end gap-2.5 border-t border-[#c9cede] bg-[#e8ecf5] px-5 py-2.5">
        <button
          disabled
          className="cursor-not-allowed rounded-full bg-[#3b4ed8] px-6 py-2 text-sm font-semibold text-white opacity-40"
        >
          Back
        </button>
        <button
          onClick={() => onStart(source, excludeBluebook)}
          disabled={loading || empty}
          className="rounded-full bg-[#3b4ed8] px-6 py-2 text-sm font-semibold text-white hover:bg-[#2f3fb8] disabled:opacity-40"
        >
          {loading ? 'Loading…' : 'Next'}
        </button>
      </footer>
    </div>
  )
}
