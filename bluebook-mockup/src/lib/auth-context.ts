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
