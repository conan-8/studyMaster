import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import {
  loadDesmos,
  saveCalcState,
  takeCalcState,
  type DesmosGraphingCalculator,
} from '../lib/desmos'

const MIN_WIDTH = 420
const MIN_HEIGHT = 240

interface DesmosCalculatorPanelProps {
  moduleId: string
  open: boolean
  onClose: () => void
}

export default function DesmosCalculatorPanel({ moduleId, open, onClose }: DesmosCalculatorPanelProps) {
  const panelRef = useRef<HTMLElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const calcRef = useRef<DesmosGraphingCalculator | null>(null)
  const [height, setHeight] = useState(460)
  const [width, setWidth] = useState<number | null>(null)
  const [resizing, setResizing] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    let cancelled = false
    let calc: DesmosGraphingCalculator | null = null
    loadDesmos()
      .then((Desmos) => {
        if (cancelled || !containerRef.current) return
        calc = Desmos.GraphingCalculator(containerRef.current, { border: false, keypad: true })
        const saved = takeCalcState(moduleId)
        if (saved !== null) calc.setState(saved)
        calcRef.current = calc
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
      if (calc) {
        saveCalcState(moduleId, calc.getState())
        calc.destroy()
        calcRef.current = null
      }
    }
  }, [moduleId])

  useEffect(() => {
    if (open) calcRef.current?.resize()
  }, [open])

  const beginResize = (e: React.PointerEvent, corner: boolean) => {
    const panel = panelRef.current
    if (!panel) return
    e.preventDefault()
    const startX = e.clientX
    const startY = e.clientY
    const startH = panel.offsetHeight
    const startW = panel.offsetWidth
    setResizing(true)
    const onMove = (ev: PointerEvent) => {
      setHeight(Math.min(Math.max(MIN_HEIGHT, startH + ev.clientY - startY), window.innerHeight - 130))
      if (corner) {
        setWidth(
          Math.min(Math.max(MIN_WIDTH, startW + 2 * (ev.clientX - startX)), window.innerWidth - 32),
        )
      }
    }
    const onUp = () => {
      setResizing(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      calcRef.current?.resize()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return (
    <section
      ref={panelRef}
      role="dialog"
      aria-label="Desmos graphing calculator"
      className={`absolute left-1/2 top-[68px] z-40 flex -translate-x-1/2 flex-col overflow-hidden rounded-b-xl bg-white shadow-[0_14px_44px_rgba(16,31,60,0.35)] ring-1 ring-[#c9cede] ${
        open ? '' : 'invisible pointer-events-none'
      } ${width === null ? 'w-[min(80vw,860px)]' : ''}`}
      style={{ height, width: width ?? undefined }}
    >
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-[#e6e8ec] bg-[#f7f8fa] px-3">
        <span className="text-[12px] font-bold uppercase tracking-wide text-[#3c4048]">
          Desmos Graphing Calculator
        </span>
        <button
          onClick={onClose}
          aria-label="Close calculator"
          className="rounded p-1 text-[#5b616e] hover:bg-[#e9ebef]"
        >
          <X size={16} />
        </button>
      </div>

      {loadError ? (
        <div className="flex flex-1 items-center justify-center px-6 text-center text-[14px] text-[#5b616e]">
          Could not load the Desmos calculator. Check your internet connection and try reloading.
        </div>
      ) : (
        <div ref={containerRef} className={`min-h-0 flex-1 ${resizing ? 'pointer-events-none' : ''}`} />
      )}

      <div
        className="relative h-3 shrink-0 cursor-row-resize touch-none bg-[#f7f8fa]"
        onPointerDown={(e) => beginResize(e, false)}
        aria-hidden="true"
      >
        <div className="absolute left-1/2 top-1/2 h-1 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#c3c8d4]" />
        <div
          className="absolute right-0 top-0 h-3 w-4 cursor-nwse-resize"
          onPointerDown={(e) => {
            e.stopPropagation()
            beginResize(e, true)
          }}
        />
      </div>
    </section>
  )
}
