import { Routes, Route } from 'react-router'
import { useEffect, useRef, type ReactNode } from 'react'
import { AuthProvider } from './lib/auth'
import { useAuth } from './lib/auth-context'
import Home from './pages/Home'
import Login from './pages/Login'
import ZenScreen from './components/ZenScreen'
import Review from './pages/Review'

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  // If this page was reached signed-out (or mid-OAuth-callback), a successful
  // sign-in should hand off to the dashboard (the looseleaf hub at the origin
  // root) instead of silently revealing whatever simulator view the user
  // landed on.
  const signedOutAtLoad = useRef(
    typeof window !== 'undefined' &&
      (window.location.search.includes('code=') || window.location.hash.includes('access_token=')),
  )
  useEffect(() => {
    if (!loading && !user) signedOutAtLoad.current = true
  }, [loading, user])
  useEffect(() => {
    if (!loading && user && signedOutAtLoad.current) {
      window.location.href = `${window.location.origin}/`
    }
  }, [loading, user])
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f5f7] text-sm text-[#5b616e]">
        Loading…
      </div>
    )
  }
  if (!user) return <Login />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <Home />
            </RequireAuth>
          }
        />
        <Route
          path="/zen"
          element={
            <RequireAuth>
              <ZenScreen />
            </RequireAuth>
          }
        />
        <Route
          path="/review"
          element={
            <RequireAuth>
              <Review />
            </RequireAuth>
          }
        />
      </Routes>
    </AuthProvider>
  )
}
