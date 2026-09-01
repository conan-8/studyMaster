import { useEffect, useState } from 'react'
import { formatTime } from './TopBar'

const BREAK_SECONDS = 10 * 60

const BREAK_RULES = [
  "Don't discuss test questions with anyone during the break.",
  "Don't use phones, smartwatches, or any other electronic devices.",
  'Eat or drink only in designated areas, away from your testing device.',
  'Leave the app open — do not close your device or quit the exam.',
  'Be back at your seat before the break timer runs out.',
]

interface BreakScreenProps {
  onResume: () => void
}

export default function BreakScreen({ onResume }: BreakScreenProps) {
  const [secondsLeft, setSecondsLeft] = useState(BREAK_SECONDS)

  useEffect(() => {
    const t = window.setInterval(() => setSecondsLeft((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearInterval(t)
  }, [])

  const ended = secondsLeft === 0

  if (ended) {
    return (
      <div className="relative flex min-h-screen items-center justify-center bg-[#1f1f1f] px-6 text-white">
        <div className="text-center">
          <h1 className="text-[30px] font-bold">Resume Testing Now</h1>
          <p className="mt-4 text-[15px] text-[#c9ccd4]">Your testing timer has not started counting down yet.</p>
          <button
            onClick={onResume}
            className="mt-8 rounded-full bg-[#f7d54d] px-9 py-3 text-[15px] font-bold text-[#1c1c1e] hover:bg-[#efc93a]"
          >
            Resume Testing
          </button>
        </div>
        <p className="absolute bottom-6 left-8 text-[15px] font-bold text-white">Conan Yi</p>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen bg-[#1f1f1f] px-8 py-12 text-white md:px-16">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-[32px] font-bold">Practice Test Break</h1>
        <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-[#c9ccd4]">
          You can resume this practice test as soon as you're ready to move on. On test day, you'd wait until the break
          timer counts all the way down. Read below to see how breaks work on test day.
        </p>

        <div className="my-9 border-t border-[#4a4a4a]" />

        <div className="grid gap-12 md:grid-cols-[minmax(300px,380px)_1fr]">
          <div>
            <div className="rounded-xl border border-[#6d6d6d] px-8 py-7 text-center">
              <p className="text-[15px] font-semibold text-[#e6e6e6]">Remaining Break Time:</p>
              <p className="mt-2 text-[56px] font-semibold leading-none tabular-nums">{formatTime(secondsLeft)}</p>
            </div>
            <button
              onClick={onResume}
              className="mt-6 rounded-full bg-[#f7d54d] px-9 py-3 text-[15px] font-bold text-[#1c1c1e] hover:bg-[#efc93a]"
            >
              Resume Testing
            </button>
          </div>

          <div>
            <h2 className="text-[20px] font-bold">Take a Break: Do Not Close Your Device</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-[#c9ccd4]">
              When the break ends, a Resume Testing Now message will appear and you'll start the next section.
            </p>
            <p className="mt-5 text-[15px] font-semibold text-[#e6e6e6]">Follow these rules during the break:</p>
            <ol className="mt-3 list-decimal space-y-2.5 pl-6 text-[15px] leading-relaxed text-[#c9ccd4]">
              {BREAK_RULES.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      <p className="absolute bottom-6 left-8 text-[15px] font-bold text-white md:left-16">Conan Yi</p>
    </div>
  )
}
