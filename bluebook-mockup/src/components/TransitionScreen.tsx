import { useEffect } from 'react'

interface TransitionScreenProps {
  onContinue: () => void
}

export default function TransitionScreen({ onContinue }: TransitionScreenProps) {
  useEffect(() => {
    const t = window.setTimeout(onContinue, 2800)
    return () => window.clearTimeout(t)
  }, [onContinue])

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f5f7] px-6 text-[#1c1c1e]">
      <div className="text-center">
        <h1 className="text-[26px] font-bold text-[#3b4ed8]">This Module Is Over</h1>
        <p className="mt-5 text-[15px] text-[#3c4048]">All your work has been saved.</p>
        <p className="mt-1.5 text-[15px] text-[#3c4048]">You'll move on automatically in just a moment.</p>
        <p className="mt-1.5 text-[15px] text-[#3c4048]">Do not refresh this page or quit the app.</p>
        <div
          aria-hidden="true"
          className="mx-auto mt-9 h-9 w-9 animate-spin rounded-full border-4 border-[#d6d9de] border-t-[#3b4ed8]"
        />
      </div>
    </div>
  )
}
