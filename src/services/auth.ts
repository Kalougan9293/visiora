import { supabase, isSupabaseConfigured, AUDIO_BUCKET } from './supabase'
import type { ProfileRow } from '@/types/database'

export type SignUpInput = {
  email: string
  password: string
  firstName: string
  cguAccepted: boolean
  shareSessions: boolean
}

function requireClient() {
  if (!supabase || !isSupabaseConfigured()) {
    throw new Error('Supabase non configuré — renseigne VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY')
  }
  return supabase
}

async function touchLastSeen(userId: string) {
  const client = requireClient()
  await client
    .from('profiles')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', userId)
}

export const authService = {
  isReady: isSupabaseConfigured,

  touchLastSeen,

  async signUp(input: SignUpInput) {
    const client = requireClient()
    const { data, error } = await client.auth.signUp({
      email: input.email.trim().toLowerCase(),
      password: input.password,
      options: {
        data: {
          first_name: input.firstName.trim(),
          last_name: '',
          cgu_accepted: input.cguAccepted,
          share_sessions: input.shareSessions,
        },
      },
    })
    if (error) throw error
    if (data.user) {
      // Petit délai : le trigger profil peut arriver juste après
      void touchLastSeen(data.user.id).catch(() => {})
    }
    return data
  },

  async signIn(email: string, password: string) {
    const client = requireClient()
    const { data, error } = await client.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) throw error

    if (data.user) {
      void touchLastSeen(data.user.id).catch(() => {})
    }

    return data
  },

  async requestPasswordReset(email: string) {
    const client = requireClient()
    const redirectTo = `${window.location.origin}/nouveau-mot-de-passe`
    const { error } = await client.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo,
    })
    if (error) throw error
  },

  async updatePassword(password: string) {
    const client = requireClient()
    const { error } = await client.auth.updateUser({ password })
    if (error) throw error
  },

  async signOut() {
    const client = requireClient()
    const { error } = await client.auth.signOut()
    if (error) throw error
  },

  async getSession() {
    if (!supabase) return null
    const { data } = await supabase.auth.getSession()
    return data.session
  },

  async getProfile(userId: string): Promise<ProfileRow | null> {
    const client = requireClient()
    const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (error) throw error
    return data
  },

  /** Chemin Storage prévu : audios/{userId}/{sessionId}.mp3 */
  audioObjectPath(userId: string, sessionId: string, ext = 'mp3') {
    return `${userId}/${sessionId}.${ext}`
  },

  audioBucket: AUDIO_BUCKET,
}
