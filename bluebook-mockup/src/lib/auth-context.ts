import { createContext, useContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export interface AuthState {
  user: User | null
  session: Session | null
  /** true until the persisted session has been read on first load */
  loading: boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthState>({ user: null, session: null, loading: true, signOut: async () => {} })

export function useAuth(): AuthState {
  return useContext(AuthContext)
}

/** Display name for the signed-in user: Google full name, else email local part. */
export function displayName(user: User | null): string {
  if (!user) return ''
  const meta = user.user_metadata as Record<string, unknown> | undefined
  const full = (meta?.full_name ?? meta?.name) as string | undefined
  if (full && full.trim()) return full.trim()
  return user.email?.split('@')[0] || 'Student'
}
