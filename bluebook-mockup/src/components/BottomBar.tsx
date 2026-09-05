import { ChevronDown, ChevronUp } from 'lucide-react'
import { displayName, useAuth } from '../lib/auth-context'

interface BottomBarProps {
  index: number
  total: number
  navOpen: boolean
  onToggleNavigator: () => void
  onBack: () => void
  onNext: () => void
  onReport?: () => void
}

export default function BottomBar({ index, total, navOpen, onToggleNavigator, onBack, onNext, onReport }: BottomBarProps) {
  const { user } = useAuth()
  return (
    <footer className="flex items-center justify-between gap-4 border-t border-[#c9cede] bg-[#e8ecf5] px-6 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <p className="truncate text-[17px] font-bold text-[#1c1c1e]">{displayName(user)}</p>
        {onReport && (
          <button
            onClick={onReport}
            className="shrink-0 rounded-full border border-[#8a8f99] px-3 py-1 text-[12px] font-semibold text-[#5b616e] hover:bg-[#dfe3ee]"
          >
            Report question error
          </button>
        )}
      </div>

      <button
        onClick={onToggleNavigator}
        className="flex items-center gap-1.5 rounded-full bg-[#1c1c1e] px-6 py-2.5 text-[15px] font-semibold text-white hover:bg-[#333338]"
        aria-expanded={navOpen}
      >
        Question {index + 1} of {total}
        {navOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
      </button>

      <div className="flex flex-1 items-center justify-end gap-2.5">
        <button
          onClick={onBack}
          disabled={index === 0}
          className="rounded-full bg-[#3b4ed8] px-7 py-2.5 text-[15px] font-semibold text-white hover:bg-[#2f3fb8] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[#3b4ed8]"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="rounded-full bg-[#3b4ed8] px-7 py-2.5 text-[15px] font-semibold text-white hover:bg-[#2f3fb8]"
        >
          Next
        </button>
      </div>
    </footer>
  )
}
