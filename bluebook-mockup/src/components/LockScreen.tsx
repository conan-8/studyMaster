import { useEffect, useRef, useState } from 'react'
import './lock-screen.css'

/**
 * Exam-lock overlay — just the lock sequence from the hand-built animation
 * (exam-lock/, commit 51ff2f0). Plays automatically on mount, then hands
 * straight into the exam (no extra click — the timer starts as the exam
 * screen appears).
 */

export default function LockScreen({ onDone }: { onDone: () => void }) {
  const [locked, setLocked] = useState(false)
  const timers = useRef<number[]>([])

  useEffect(() => {
    timers.current = [
      // lock + shackle + flash run 1.35s; then a brief "locked" beat...
      window.setTimeout(() => setLocked(true), 1250),
      // ...and straight into the exam.
      window.setTimeout(onDone, 1950),
    ]
    return () => timers.current.forEach((t) => window.clearTimeout(t))
  }, [onDone])

  const replay = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    setLocked(false)
    timers.current = [
      window.setTimeout(() => setLocked(true), 1250),
      window.setTimeout(onDone, 1950),
    ]
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

      <div className={`examlock-lockedui${locked ? ' show' : ''}`}>
        <div className="lockIcon">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#eaf7ff" strokeWidth="2">
            <rect x="4" y="10" width="16" height="11" rx="2.5" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
        </div>
        <div className="title">Device locked · Exam mode</div>
      </div>

      <button className={`examlock-replay${locked ? ' show' : ''}`} onClick={replay}>
        ↺ Replay
      </button>
    </div>
  )
}
