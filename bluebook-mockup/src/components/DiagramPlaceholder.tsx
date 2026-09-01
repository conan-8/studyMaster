import { useMemo, useState } from 'react'
import { Maximize2, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react'
import type { DiagramSpec } from '../types/exam'

function Glyph({ kind, scale = 1 }: { kind: NonNullable<DiagramSpec['kind']>; scale?: number }) {
  const stroke = '#4a4f59'
  if (kind === 'triangle') {
    return (
      <svg width={120 * scale} height={92 * scale} viewBox="0 0 120 92" aria-hidden="true">
        <polygon points="60,10 110,80 10,80" fill="none" stroke={stroke} strokeWidth="2" />
        <text x="60" y="30" textAnchor="middle" fontSize="13" fontStyle="italic" fill={stroke}>C</text>
        <text x="20" y="74" textAnchor="middle" fontSize="13" fontStyle="italic" fill={stroke}>A</text>
        <text x="100" y="74" textAnchor="middle" fontSize="13" fontStyle="italic" fill={stroke}>B</text>
        <text x="34" y="66" textAnchor="middle" fontSize="11" fill={stroke}>35°</text>
        <text x="86" y="66" textAnchor="middle" fontSize="11" fill={stroke}>65°</text>
      </svg>
    )
  }
  if (kind === 'parabola') {
    return (
      <svg width={140 * scale} height={110 * scale} viewBox="0 0 140 110" aria-hidden="true">
        <line x1="70" y1="4" x2="70" y2="106" stroke={stroke} strokeWidth="1" />
        <line x1="4" y1="86" x2="136" y2="86" stroke={stroke} strokeWidth="1" />
        <path d="M 24 8 Q 70 118 116 8" fill="none" stroke={stroke} strokeWidth="2" />
        <text x="132" y="80" textAnchor="middle" fontSize="11" fontStyle="italic" fill={stroke}>x</text>
        <text x="76" y="12" textAnchor="middle" fontSize="11" fontStyle="italic" fill={stroke}>y</text>
      </svg>
    )
  }
  return (
    <svg width={150 * scale} height={110 * scale} viewBox="0 0 150 110" aria-hidden="true">
      <line x1="8" y1="98" x2="146" y2="98" stroke={stroke} strokeWidth="1" />
      <rect x="20" y="52" width="18" height="46" fill="none" stroke={stroke} strokeWidth="2" />
      <rect x="50" y="40" width="18" height="58" fill="none" stroke={stroke} strokeWidth="2" />
      <rect x="80" y="24" width="18" height="74" fill="none" stroke={stroke} strokeWidth="2" />
      <rect x="110" y="48" width="18" height="50" fill="none" stroke={stroke} strokeWidth="2" />
      <text x="29" y="108" textAnchor="middle" fontSize="10" fill={stroke}>Apr</text>
      <text x="59" y="108" textAnchor="middle" fontSize="10" fill={stroke}>May</text>
      <text x="89" y="108" textAnchor="middle" fontSize="10" fill={stroke}>Jun</text>
      <text x="119" y="108" textAnchor="middle" fontSize="10" fill={stroke}>Jul</text>
    </svg>
  )
}

/** Real parameterized figure from the studyMaste renderer bundle. */
function LiveSvg({ diagram, scale }: { diagram: NonNullable<DiagramSpec['live']>; scale: number }) {
  const svg = useMemo(() => {
    const R = (window as unknown as { StudyMasteRenderers?: { render: (id: string, p: Record<string, unknown>) => string } })
      .StudyMasteRenderers
    if (!R) return null
    try {
      return R.render(diagram.archetypeId, structuredClone(diagram.parameters)).replace(/^<\?xml[^?]*\?>\s*/, '')
    } catch {
      return null
    }
  }, [diagram])
  if (svg === null) return <Glyph kind="triangle" scale={scale} />
  return (
    <div style={{ width: `${scale * 100}%`, transformOrigin: 'top center' }} dangerouslySetInnerHTML={{ __html: svg }} />
  )
}

const ZOOM_STEPS = [50, 75, 100, 125, 150, 200]

export default function DiagramPlaceholder({ diagram }: { diagram: DiagramSpec }) {
  const [zoomIdx, setZoomIdx] = useState(2)
  const [fullscreen, setFullscreen] = useState(false)
  const zoom = ZOOM_STEPS[zoomIdx]
  const scale = zoom / 100

  const body = (
    <div className="flex w-full justify-center">
      {diagram.live ? (
        <LiveSvg diagram={diagram.live} scale={scale} />
      ) : (
        <Glyph kind={diagram.kind ?? 'triangle'} scale={scale} />
      )}
    </div>
  )

  return (
    <>
      <figure className="mx-auto my-6 w-full max-w-[520px] overflow-hidden rounded-lg border border-[#b9bec9] bg-white">
        {/* Image toolbar */}
        <div className="flex items-center gap-4 border-b border-[#e2e4ea] px-4 py-2 text-[#1c1c1e]">
          <button
            onClick={() => setZoomIdx((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
            aria-label="Zoom in"
            className="hover:text-[#3b4ed8]"
          >
            <ZoomIn size={17} />
          </button>
          <button
            onClick={() => setZoomIdx((i) => Math.max(0, i - 1))}
            aria-label="Zoom out"
            className="hover:text-[#3b4ed8]"
          >
            <ZoomOut size={17} />
          </button>
          <span className="w-10 text-center text-sm tabular-nums">{zoom}%</span>
          <button
            onClick={() => setZoomIdx(2)}
            className="flex items-center gap-1 text-sm font-semibold hover:text-[#3b4ed8]"
          >
            <RotateCcw size={13} /> Reset
          </button>
          <span className="h-5 w-px bg-[#d6d9de]" />
          <button onClick={() => setFullscreen(true)} aria-label="Open fullscreen" className="hover:text-[#3b4ed8]">
            <Maximize2 size={15} />
          </button>
        </div>

        <div className="flex justify-center overflow-auto px-6 py-6">{body}</div>
        {diagram.caption && (
          <figcaption className="pb-4 text-center font-exam-serif text-sm text-[#3c4048]">{diagram.caption}</figcaption>
        )}
      </figure>

      {fullscreen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-8"
          role="dialog"
          aria-modal="true"
          onClick={() => setFullscreen(false)}
        >
          <div
            className="relative max-h-full max-w-3xl overflow-auto rounded-lg bg-white p-10"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setFullscreen(false)}
              aria-label="Close fullscreen image"
              className="absolute right-3 top-3 rounded-full p-1.5 text-[#5b616e] hover:bg-[#f4f5f7]"
            >
              <X size={18} />
            </button>
            <div className="flex justify-center">
              {diagram.live ? <LiveSvg diagram={diagram.live} scale={2} /> : <Glyph kind={diagram.kind ?? 'triangle'} scale={2} />}
            </div>
            {diagram.caption && (
              <p className="mt-4 text-center font-exam-serif text-sm text-[#3c4048]">{diagram.caption}</p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
