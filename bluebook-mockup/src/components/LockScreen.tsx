import { useEffect, useRef, useState } from 'react'
import './lock-screen.css'

/**
 * Exam-lock intro — React port of the hand-built animation in
 * exam-lock/index.html (commit 51ff2f0). Home screen -> Start -> the lock
 * grows and snaps shut with a light wash -> "Device locked · Exam mode" ->
 * Start Exam begins the test.
 */

const cp = (n: number) => String.fromCodePoint(n)

const ICONS: Array<[string, string]> = [
  [cp(128300), '#5b8def'], [cp(128736), '#3b6fd4'], [cp(9881), '#8a94a6'], [cp(128171), '#4aa3ff'],
  [cp(128193), '#f7b731'], [cp(128722), '#e8a33d'], [cp(128248), '#a55eea'], [cp(127925), '#fc5c65'],
  [cp(9007), '#f5f6fa'], [cp(128197), '#ffffff'], [cp(128179), '#eb3b5a'], [cp(128215), '#e84118'],
  ['G', '#ffffff'], [cp(128102), '#778ca3'], [cp(128506), '#45aaf2'], [cp(127909), '#8854d0'],
  [cp(128221), '#f7b731'], [cp(128269), '#20bf6b'], [cp(9200), '#f5f6fa'], [cp(127912), '#fa8231'],
  [cp(10024), '#3867d6'], [cp(127828), '#2bcbba'], [cp(10039), '#fd9644'], [cp(9654), '#ff3838'],
  [cp(128240), '#4b6584'], [cp(128188), '#26de81'], ['B', '#6c5ce7'], [cp(128172), '#2bcbba'],
  [cp(9993), '#4a69bd'], ['U', '#2d3436'], [cp(9854), '#00cec9'], ['T', '#e17055'],
]

const DOCK_ICONS: Array<[string, string]> = [
  [cp(9993), '#ffffff'], [cp(128222), '#2bcbba'], [cp(128247), '#8a94a6'],
  [cp(127912), '#fa8231'], [cp(127761), '#a55eea'], [cp(128172), '#2bcbba'], [cp(127925), '#fc5c65'],
]

type Phase = 'home' | 'locking' | 'locked'

export default function LockScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>('home')
  const timer = useRef<number | null>(null)

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current) }, [])

  const start = () => {
    setPhase('locking')
    timer.current = window.setTimeout(() => setPhase('locked'), 1250)
  }

  const replay = () => setPhase('home')

  const homeClasses = ['examlock-home-content']
  if (phase === 'locking') homeClasses.push('blurred')
  if (phase === 'locked') homeClasses.push('locked')
  const playing = phase !== 'home'

  return (
    <div className="examlock-stage">
      <div className="examlock-homescreen">
        <div className={homeClasses.join(' ')}>
          <div className="examlock-statusbar">
            <span>06:29</span>
            <span className="right">{cp(128242)}️&nbsp;&nbsp;{cp(128246)} {cp(128225)}&nbsp;&nbsp;44%</span>
          </div>
          <div className="examlock-clock">
            <div className="t">06:29</div>
            <div className="d"><span>Mon, Aug 31</span><span>{cp(9925)} 20°</span></div>
          </div>
          <div className="examlock-widget">
            <div className="big">31</div>
            <div className="sub">Monday · 1 event today</div>
            <div className="ev"><span>8:00 PM Practice</span><span>10:00 PM</span></div>
          </div>
          <div className="examlock-grid">
            {ICONS.map(([g, c], i) => {
              const dark = c === '#ffffff' || c === '#f5f6fa'
              return (
                <div key={i} className="examlock-app" style={{ background: `linear-gradient(160deg, ${c}, ${c}cc)` }}>
                  <span style={{ color: dark ? '#555' : '#fff' }}>{g}</span>
                  {i === 6 && <div className="examlock-badge">1</div>}
                  {i === 27 && <div className="examlock-badge">99+</div>}
                </div>
              )
            })}
          </div>
          <div className="examlock-dock">
            {DOCK_ICONS.map(([g, c], i) => {
              const dark = c === '#ffffff'
              return (
                <div key={i} className="examlock-app" style={{ background: `linear-gradient(160deg, ${c}, ${c}cc)` }}>
                  <span style={{ color: dark ? '#c0392b' : '#fff' }}>{g}</span>
                </div>
              )
            })}
          </div>
        </div>

        <button className={`examlock-start${playing ? ' hide' : ''}`} onClick={start}>
          Start
        </button>

        <div className={`examlock-flash${playing ? ' play' : ''}`} />

        <div className="examlock-lockwrap">
          <div className={`examlock-lock${playing ? ' play' : ''}`}>
            <svg viewBox="0 0 120 140" fill="none">
              <g className="shackle">
                <path d="M38 68 V46 a22 22 0 0 1 44 0 V68" stroke="#eaf7ff" strokeWidth="11" strokeLinecap="round" />
              </g>
              <rect x="20" y="62" width="80" height="62" rx="16" stroke="#eaf7ff" strokeWidth="11" fill="rgba(190,225,255,.10)" />
              <circle cx="60" cy="88" r="7" fill="#eaf7ff" />
              <rect x="56.5" y="90" width="7" height="16" rx="3.5" fill="#eaf7ff" />
            </svg>
          </div>
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
    </div>
  )
}
