import { useEffect, useMemo, useState } from 'react'
import { fetchBank, type BankQuestion } from '../data/live'
import QuestionView from '../components/QuestionView'
import { probeApi } from '../lib/reviewApi'
import type { ExamModule } from '../types/exam'

type Status = 'pending' | 'approved' | 'returned'

interface ReviewState {
  status: Status
  reasons?: string[]
  note?: string | null
  at?: string
}

const REASONS: Array<{ id: string; label: string }> = [
  { id: 'info-prompt-split', label: 'Wrong info/prompt split' },
  { id: 'options', label: 'Wrong options' },
  { id: 'figure', label: 'Wrong figure' },
  { id: 'other', label: 'Other' },
]

const STATUS_ORDER: Record<Status, number> = { pending: 0, returned: 1, approved: 2 }

const noop = () => {}

export default function Review() {
  const [questions, setQuestions] = useState<BankQuestion[] | null>(null)
  const [statuses, setStatuses] = useState<Record<string, ReviewState>>({})
  const [statusFilter, setStatusFilter] = useState<Status | 'all'>('pending')
  const [skillFilter, setSkillFilter] = useState('all')
  const [diagramsOnly, setDiagramsOnly] = useState(false)
  const [idx, setIdx] = useState(0)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [reasons, setReasons] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [apiBase, setApiBase] = useState<string | null>(null)
  const [apiDown, setApiDown] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchBank(), probeApi()])
      .then(async ([bank, base]) => {
        if (cancelled) return
        setQuestions(bank.harvested.filter((q) => q.approved !== undefined))
        if (base === null) {
          setApiDown(true)
          return
        }
        setApiBase(base)
        const st = (await fetch(`${base}/api/curated-status`).then((r) => (r.ok ? r.json() : {}))) as Record<
          string,
          ReviewState
        >
        if (!cancelled) setStatuses(st)
      })
      .catch((e) => setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [])

  const statusOf = (id: string): Status => statuses[id]?.status ?? 'pending'

  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, returned: 0 }
    for (const q of questions ?? []) c[statusOf(q.id)]++
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, statuses])

  const queue = useMemo(() => {
    if (!questions) return []
    let qs = questions
    if (diagramsOnly) qs = qs.filter((q) => q.imageAsset || q.table)
    if (statusFilter !== 'all') qs = qs.filter((q) => statusOf(q.id) === statusFilter)
    if (skillFilter !== 'all') qs = qs.filter((q) => q.archetype === skillFilter)
    return [...qs].sort((a, b) => STATUS_ORDER[statusOf(a.id)] - STATUS_ORDER[statusOf(b.id)])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questions, statuses, statusFilter, skillFilter, diagramsOnly])

  useEffect(() => {
    setIdx((i) => Math.min(i, Math.max(0, queue.length - 1)))
  }, [queue.length])

  const skills = useMemo(() => [...new Set((questions ?? []).map((q) => q.archetype))].sort(), [questions])

  const current = queue[idx]

  async function decide(status: 'approved' | 'returned', sendReasons?: string[], sendNote?: string | null) {
    const q = queue[idx]
    if (!q || busy || apiBase === null) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`${apiBase}/api/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: q.id, status, reasons: sendReasons, note: sendNote }),
      })
      const body = (await res.json()) as { error?: string; review?: ReviewState }
      if (!res.ok || !body.review) throw new Error(body.error ?? `HTTP ${res.status}`)
      setStatuses((s) => ({ ...s, [q.id]: body.review as ReviewState }))
      setPopoverOpen(false)
      setReasons([])
      setNote('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT') return
      if (popoverOpen) {
        if (e.key === 'Escape') setPopoverOpen(false)
        else if (e.key === 'Enter') {
          e.preventDefault()
          void decide('returned', reasons, note.trim() || null)
        }
        return
      }
      if (e.key === 'a' || e.key === 'A') void decide('approved')
      else if (e.key === 'r' || e.key === 'R') setPopoverOpen(true)
      else if (e.key === 'ArrowRight') setIdx((i) => Math.min(queue.length - 1, i + 1))
      else if (e.key === 'ArrowLeft') setIdx((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (error && !questions) {
    return <div className="p-10 font-exam-serif text-[17px] text-[#c62828]">{error}</div>
  }
  if (!questions) {
    return <div className="p-10 font-exam-serif text-[17px]">Loading curated questions…</div>
  }
  if (!current) {
    return (
      <div className="p-10 font-exam-serif text-[17px]">
        Nothing in this view — change the status/skill filter above.
      </div>
    )
  }

  const module: ExamModule = {
    id: 'review',
    label: 'Review',
    title: current.section === 'rw' ? 'Reading and Writing' : 'Math',
    minutes: 0,
    split: current.section === 'rw',
    questions: [current],
  }
  const st = statusOf(current.id)
  const curReview = statuses[current.id]

  return (
    <div className="flex h-screen flex-col bg-[#f4f5f7] text-[#1c1c1e]">
      <header className="flex flex-wrap items-center gap-3 border-b border-[#d6d9de] bg-white px-5 py-2.5">
        <span className="font-exam-serif text-[17px] font-bold">Question review</span>
        <span className="rounded-full bg-[#d4edda] px-3 py-0.5 text-[13px] font-semibold text-[#1e6b34]">
          {counts.approved} approved
        </span>
        <span className="rounded-full bg-[#f8d7da] px-3 py-0.5 text-[13px] font-semibold text-[#8b1f2b]">
          {counts.returned} returned
        </span>
        <span className="rounded-full bg-[#eee] px-3 py-0.5 text-[13px] font-semibold text-[#444]">
          {counts.pending} pending
        </span>
        <span className="ml-auto text-[13px] text-[#5b616e]">
          {idx + 1} / {queue.length}
        </span>
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as Status | 'all')
            setIdx(0)
          }}
          className="rounded-md border border-[#6d7380] bg-white px-2 py-1 text-[13px]"
        >
          <option value="pending">pending</option>
          <option value="approved">approved</option>
          <option value="returned">returned</option>
          <option value="all">all</option>
        </select>
        <select
          value={skillFilter}
          onChange={(e) => {
            setSkillFilter(e.target.value)
            setIdx(0)
          }}
          className="rounded-md border border-[#6d7380] bg-white px-2 py-1 text-[13px]"
        >
          <option value="all">all skills</option>
          {skills.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            setDiagramsOnly((v) => !v)
            setIdx(0)
          }}
          className={`rounded-full border px-3 py-1 text-[13px] font-semibold ${
            diagramsOnly ? 'border-[#1e2350] bg-[#1e2350] text-white' : 'border-[#9aa1ad] bg-white text-[#3c4048]'
          }`}
        >
          diagrams only
        </button>
      </header>

      {apiDown && (
        <div className="bg-[#fff3cd] px-5 py-1.5 text-[13px] font-semibold text-[#7a5c00]">
          Review API unreachable — decisions will not persist. Start the review server with{' '}
          <code>PORT=4174 npm run serve</code> (or free port 4173 for <code>npm run serve</code>), then reload.
        </div>
      )}
      {error && <div className="bg-[#f8d7da] px-5 py-1.5 text-[13px] font-semibold text-[#8b1f2b]">{error}</div>}

      <main className="flex-1 overflow-hidden bg-white">
        <QuestionView
          module={module}
          question={current}
          number={idx + 1}
          answer={undefined}
          flagged={false}
          crossed={[]}
          onAnswer={noop}
          onToggleFlag={noop}
          onToggleCross={noop}
        />
      </main>

      <footer className="relative flex items-center gap-3 border-t border-[#d6d9de] bg-white px-5 py-3">
        <span
          className={`rounded-full px-3 py-0.5 text-[13px] font-semibold ${
            st === 'approved'
              ? 'bg-[#d4edda] text-[#1e6b34]'
              : st === 'returned'
                ? 'bg-[#f8d7da] text-[#8b1f2b]'
                : 'bg-[#eee] text-[#444]'
          }`}
        >
          {st}
          {st === 'returned' && curReview?.reasons?.length ? ` — ${curReview.reasons.join(', ')}` : ''}
        </span>
        {st === 'returned' && curReview?.note && (
          <span className="max-w-[40%] truncate text-[13px] italic text-[#5b616e]">{curReview.note}</span>
        )}
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            className="rounded-md border border-[#6d7380] bg-white px-4 py-2 text-[15px] font-semibold"
          >
            ← Back
          </button>
          <button
            onClick={() => setPopoverOpen(true)}
            className="rounded-md border border-[#c62828] bg-white px-4 py-2 text-[15px] font-semibold text-[#c62828] hover:bg-[#f8d7da]"
          >
            Send back (R)
          </button>
          <button
            disabled={busy}
            onClick={() => void decide('approved')}
            className="rounded-md bg-[#1e6b34] px-5 py-2 text-[15px] font-semibold text-white hover:bg-[#17542a]"
          >
            Approve (A)
          </button>
          <button
            onClick={() => setIdx((i) => Math.min(queue.length - 1, i + 1))}
            className="rounded-md border border-[#6d7380] bg-white px-4 py-2 text-[15px] font-semibold"
          >
            Skip →
          </button>
        </div>

        {popoverOpen && (
          <div className="absolute bottom-full right-5 mb-2 w-[380px] rounded-lg border border-[#d6d9de] bg-white p-4 shadow-lg">
            <p className="mb-2 text-[14px] font-bold">Why is {current.id} going back?</p>
            <div className="flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button
                  key={r.id}
                  onClick={() =>
                    setReasons((cur) => (cur.includes(r.id) ? cur.filter((x) => x !== r.id) : [...cur, r.id]))
                  }
                  className={`rounded-full border px-3 py-1 text-[13px] font-semibold ${
                    reasons.includes(r.id)
                      ? 'border-[#c62828] bg-[#c62828] text-white'
                      : 'border-[#9aa1ad] bg-white text-[#3c4048]'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note (what exactly is wrong?)"
              className="mt-3 h-20 w-full rounded-md border border-[#6d7380] p-2 text-[13px]"
            />
            <div className="mt-2 flex justify-end gap-2">
              <button
                onClick={() => setPopoverOpen(false)}
                className="rounded-md border border-[#6d7380] bg-white px-3 py-1.5 text-[13px] font-semibold"
              >
                Cancel (Esc)
              </button>
              <button
                disabled={busy}
                onClick={() => void decide('returned', reasons, note.trim() || null)}
                className="rounded-md bg-[#c62828] px-3 py-1.5 text-[13px] font-semibold text-white"
              >
                Send back (Enter)
              </button>
            </div>
          </div>
        )}
      </footer>
    </div>
  )
}
