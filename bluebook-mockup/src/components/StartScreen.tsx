import { BarChart3, Clock3, LockOpen, PersonStanding } from 'lucide-react'

interface StartScreenProps {
  onStart: () => void
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

export default function StartScreen({ onStart }: StartScreenProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[#f4f5f7] text-[#1c1c1e]">
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          <h1 className="text-center text-[30px] font-bold">Practice Test</h1>

          <div className="mt-8 rounded-2xl border border-[#d6d9de] bg-white px-8 py-4 shadow-sm">
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
            Unofficial mockup with original sample items and lorem-ipsum placeholders. Not affiliated with or endorsed
            by the College Board.
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
          onClick={onStart}
          className="rounded-full bg-[#3b4ed8] px-6 py-2 text-sm font-semibold text-white hover:bg-[#2f3fb8]"
        >
          Next
        </button>
      </footer>
    </div>
  )
}
