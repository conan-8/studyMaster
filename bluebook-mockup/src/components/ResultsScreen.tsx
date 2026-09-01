import { useMemo } from 'react'

const CONFETTI_COLORS = ['#f7d54d', '#f48fb1', '#80deea', '#ffffff', '#ffcc80']

interface ResultsScreenProps {
  onExit: () => void
}

export default function ResultsScreen({ onExit }: ResultsScreenProps) {
  const confetti = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        left: (i * 37 + 13) % 100,
        top: (i * 23 + 7) % 100,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rot: (i * 53) % 360,
        delay: (i % 7) * 0.4,
        wide: i % 3 === 0,
      })),
    [],
  )

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#1e2350] text-white">
      {/* Confetti */}
      {confetti.map((c, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="absolute rounded-[1px] opacity-90"
          style={
            {
              left: `${c.left}%`,
              top: `${c.top}%`,
              width: c.wide ? 10 : 6,
              height: c.wide ? 4 : 10,
              backgroundColor: c.color,
              '--bb-rot': `${c.rot}deg`,
              transform: `rotate(${c.rot}deg)`,
              animation: `bb-float 3.2s ease-in-out ${c.delay}s infinite`,
            } as React.CSSProperties
          }
        />
      ))}

      <header className="relative z-10 flex items-center justify-between bg-white px-6 py-3 text-[#1c1c1e]">
        <p className="text-sm font-bold">Bluebook Practice Exams</p>
        <button onClick={onExit} className="text-sm font-semibold text-[#1c1c1e] hover:text-[#3b4ed8]">
          Return to Home
        </button>
      </header>

      <main className="relative z-10 flex flex-col items-center px-6 py-16">
        <h1 className="text-[34px] font-bold">You're All Finished!</h1>

        <div className="mt-10 flex w-full max-w-2xl items-center gap-8 rounded-2xl bg-white p-9 text-[#1c1c1e]">
          {/* Laptop illustration */}
          <svg width="150" height="120" viewBox="0 0 150 120" aria-hidden="true" className="shrink-0">
            <rect x="25" y="15" width="100" height="70" rx="6" fill="#eef1fc" stroke="#1c1c1e" strokeWidth="2.5" />
            <circle cx="75" cy="50" r="20" fill="#bfe3f7" stroke="#1c1c1e" strokeWidth="2.5" />
            <circle cx="68" cy="46" r="2.4" fill="#1c1c1e" />
            <circle cx="82" cy="46" r="2.4" fill="#1c1c1e" />
            <path d="M 67 55 Q 75 62 83 55" fill="none" stroke="#1c1c1e" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 15 92 L 135 92 L 128 100 L 22 100 Z" fill="#d6d9de" stroke="#1c1c1e" strokeWidth="2.5" />
          </svg>
          <p className="text-[16px] leading-relaxed">
            Congratulations on completing this SAT practice test! This mockup doesn't score your work or show an answer
            key.
          </p>
        </div>

        <button
          onClick={onExit}
          className="mt-12 rounded-full bg-[#f7d54d] px-10 py-3.5 text-[15px] font-bold text-[#1c1c1e] hover:bg-[#efc93a]"
        >
          Restart Practice Test
        </button>
      </main>
    </div>
  )
}
