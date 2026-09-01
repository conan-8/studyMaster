import { useEffect, useRef, useState } from 'react'
import './lock-screen.css'

/**
 * Exam-lock overlay — just the lock sequence from the hand-built animation
 * (exam-lock/, commit 51ff2f0): the lock grows and snaps shut with a light
 * wash over a blurred view of the app, then "Device locked · Exam mode"
 * with the Start Exam button. Plays automatically on mount.
 */

type Phase = 'locking' | 'locked'

export default function LockScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>('locking')
  const timer = useRef<number | null>(null)

  useEffect(() => {
    timer.current = window.setTimeout(() => setPhase('locked'), 1250)
    return () => {
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [])

  const replay = () => {
    setPhase('locking')
    timer.current = window.setTimeout(() => setPhase('locked'), 1250)
  }

  return (
    <div className="examlock-overlay">
      <div className="examlock-flash play" />

      <div className="examlock-lock play">
        <svg viewBox="0 0 120 140" fill="none">
          <g className="shackle">
            <path d="M38 68 V46 a22 22 0 0 1 44 0 V68" stroke="#eaf7ff" strokeWidth="11" strokeLinecap="round" />
          </g>
          <rect x="20" y="62" width="80" height="62" rx="16" stroke="#eaf7ff" strokeWidth="11" fill="rgba(190,225,255,.10)" />
          <circle cx="60" cy="88" r="7" fill="#eaf7ff" />
          <rect x="56.5" y="90" width="7" height="16" rx="3.5" fill="#eaf7ff" />
        </svg>
      </div>

      <div className={`examlock-lockedui${phase === 'locked' ? ' show' : ''}`}>
        <div className="lockIcon">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#eaf7ff" strokeWidth="2">
            <rect x="4" y="10" width="16" height="11" rx="2.5" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </div>
        <div className="title">Device locked · Exam mode</div>
        <button className="examlock-exambtn" onClick={onDone}>
          Start Exam
        </button>
      </div>

      <button className={`examlock-replay${phase === 'locked' ? ' show' : ''}`} onClick={replay}>
        ↺ Replay
      </button>
    </div>
  )
}
