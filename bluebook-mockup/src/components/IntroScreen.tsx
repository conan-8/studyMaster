import { useEffect, useRef } from 'react'

/**
 * Fullscreen intro animation played when the simulation (exam) starts.
 * Click anywhere to skip.
 */
export default function IntroScreen({ onDone }: { onDone: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = 0
    v.play().catch(() => onDone()) // autoplay blocked -> go straight in
  }, [onDone])

  return (
    <div className="fixed inset-0 z-[80] cursor-pointer bg-black" onClick={onDone} role="button" aria-label="Skip intro">
      <video ref={videoRef} src="/exam-intro.mp4" playsInline className="h-full w-full object-cover" />
      <span className="absolute bottom-5 right-6 rounded-full border border-white/40 bg-black/40 px-4 py-1.5 text-[13px] tracking-wide text-white">
        Skip →
      </span>
    </div>
  )
}
