import { createClient } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured, AUDIO_BUCKET } from './supabase'
import type { Database, ProfileRow } from '@/types/database'

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

function describeClient(): string {
  if (typeof navigator === 'undefined') return ''
  const ua = navigator.userAgent
  const device = /iPad/.test(ua)
    ? 'iPad'
    : /iPhone/.test(ua)
      ? 'iPhone'
      : /Android/.test(ua)
        ? 'Android'
        : /Macintosh/.test(ua)
          ? 'Mac'
          : /Windows/.test(ua)
            ? 'Windows'
            : 'Autre'
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : ''
  return [device, browser].filter(Boolean).join(' ').slice(0, 40)
}

async function touchLastSeen(userId: string) {
  const client = requireClient()
  await client
    .from('profiles')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', userId)
  const label = describeClient()
  if (!label) return
  await client.from('profiles').update({ client_label: label }).eq('id', userId)
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
    const url = import.meta.env.VITE_SUPABASE_URL ?? ''
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
    if (!url || !anonKey) {
      throw new Error('Supabase non configuré — renseigne VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY')
    }
    // Client sans session : un compte déjà ouvert ne doit pas recevoir le lien à la place de l’adresse saisie.
    const client = createClient<Database>(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
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
    const { error } = await client.auth.signOut({ scope: 'local' })
    if (error) throw error
  },

  /** Efface le compte connecté, ses séances et ses audios. */
  async deleteOwnAccount() {
    const client = requireClient()
    const invoked = await client.functions.invoke<{ ok?: boolean; error?: string }>(
      'delete-own-account',
      { method: 'POST', body: {} },
    )
    if (invoked.data?.error) throw new Error(invoked.data.error)
    if (invoked.error || !invoked.data?.ok) {
      const { error } = await client.rpc('delete_own_account')
      if (error) throw new Error(error.message)
    }
    await client.auth.signOut({ scope: 'local' }).catch(() => {})
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
