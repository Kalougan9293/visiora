import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { authService } from '@/services/auth'
import { supabase, isSupabaseConfigured } from '@/services/supabase'
import type { ProfileRow } from '@/types/database'
import type { SignUpInput } from '@/services/auth'

type AuthContextValue = {
  configured: boolean
  loading: boolean
  session: Session | null
  user: User | null
  profile: ProfileRow | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (input: SignUpInput) => Promise<{ needsEmailConfirm: boolean }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured()
  const [loading, setLoading] = useState(configured)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  const activeUserId = useRef<string | null>(null)
  const profileTicket = useRef(0)

  const loadProfile = useCallback(async (userId: string) => {
    const ticket = ++profileTicket.current
    try {
      const p = await authService.getProfile(userId)
      if (ticket !== profileTicket.current || activeUserId.current !== userId) return
      setProfile(p && p.id === userId ? p : null)
    } catch {
      if (ticket !== profileTicket.current || activeUserId.current !== userId) return
      setProfile(null)
    }
  }, [])

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    let settledByEvent = false

    const applySession = (next: Session | null, event?: string) => {
      const nextId = next?.user?.id ?? null
      const changed = activeUserId.current !== nextId
      activeUserId.current = nextId
      setSession(next)
      if (!nextId) {
        profileTicket.current += 1
        setProfile(null)
        setLoading(false)
        return
      }
      if (event === 'TOKEN_REFRESHED') {
        setLoading(false)
        return
      }
      if (changed) setProfile(null)
      void loadProfile(nextId)
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        void authService.touchLastSeen(nextId).catch(() => {})
      }
      setLoading(false)
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      settledByEvent = true
      applySession(next, event)
    })

    void supabase.auth.getSession().then(({ data }) => {
      if (settledByEvent) return
      applySession(data.session, 'INITIAL_SESSION')
    })

    return () => {
      settledByEvent = true
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    await authService.signIn(email, password)
  }, [])

  const signUp = useCallback(async (input: SignUpInput) => {
    const data = await authService.signUp(input)
    return { needsEmailConfirm: !data.session }
  }, [])

  const signOut = useCallback(async () => {
    activeUserId.current = null
    profileTicket.current += 1
    setProfile(null)
    setSession(null)
    await authService.signOut()
  }, [])

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id)
  }, [loadProfile, session?.user])

  const value = useMemo<AuthContextValue>(
    () => ({
      configured,
      loading,
      session,
      user: session?.user ?? null,
      profile,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [configured, loading, session, profile, signIn, signUp, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
