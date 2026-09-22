import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const p = await authService.getProfile(userId)
      if (p) setProfile(p)
    } catch {
      /** Garde le profil déjà chargé : un raté réseau ne doit pas “déconnecter” le prénom. */
    }
  }, [])

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    let mounted = true

    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session?.user) void loadProfile(data.session.user.id)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (!next?.user) {
        setProfile(null)
        return
      }
      if (event === 'TOKEN_REFRESHED') return
      void loadProfile(next.user.id)
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        void authService.touchLastSeen(next.user.id).catch(() => {})
      }
    })

    return () => {
      mounted = false
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
    await authService.signOut()
    setProfile(null)
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
