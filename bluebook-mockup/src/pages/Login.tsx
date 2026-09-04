import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

type Mode = 'signin' | 'signup'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

export default function Login() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({ email, password })
        if (err) throw err
        if (data.session === null) {
          setNotice('Check your inbox to confirm your email, then sign in.')
        }
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password })
        if (err) throw err
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const googleSignIn = async () => {
    setError(null)
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${window.location.pathname}` },
    })
    if (err) setError(err.message)
  }

  const inputCls =
    'w-full rounded-xl border border-[#d6d9de] bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-[#3b4ed8] focus:ring-2 focus:ring-[#3b4ed8]/20'

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f5f7] text-[#1c1c1e]">
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-center text-[26px] font-bold">studyMaste</h1>
          <p className="mt-1 text-center text-sm text-[#5b616e]">
            {mode === 'signin' ? 'Sign in to pick up where you left off' : 'Create your account'}
          </p>

          <div className="mt-6 rounded-2xl border border-[#d6d9de] bg-white px-6 py-6 shadow-sm">
            <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-[#eef0f3] p-1">
              {(['signin', 'signup'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m)
                    setError(null)
                    setNotice(null)
                  }}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                    mode === m ? 'bg-white text-[#1c1c1e] shadow-sm' : 'text-[#5b616e]'
                  }`}
                >
                  {m === 'signin' ? 'Sign in' : 'Sign up'}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="grid gap-3">
              <label className="grid gap-1.5 text-sm font-semibold">
                Email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputCls}
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">
                Password
                <input
                  type="password"
                  required
                  minLength={mode === 'signup' ? 8 : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
                  className={inputCls}
                />
              </label>
              {error && <p className="text-sm text-[#d0342c]">{error}</p>}
              {notice && <p className="text-sm text-[#1e7e34]">{notice}</p>}
              <button
                type="submit"
                disabled={busy}
                className="mt-1 rounded-xl bg-[#3b4ed8] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#2f3fb8] disabled:opacity-60"
              >
                {busy ? 'One moment…' : mode === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            </form>

            <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-[#9aa1ad]">
              <span className="h-px flex-1 bg-[#e2e4ea]" />
              or
              <span className="h-px flex-1 bg-[#e2e4ea]" />
            </div>

            <button
              onClick={googleSignIn}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-[#d6d9de] bg-white px-4 py-2.5 text-sm font-semibold transition-colors hover:border-[#9aa1ad]"
            >
              <GoogleIcon />
              Continue with Google
            </button>
          </div>

          <p className="mt-4 text-center text-xs text-[#5b616e]">
            Your practice results are saved to your account.
          </p>
        </div>
      </main>
    </div>
  )
}
