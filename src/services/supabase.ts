import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL ?? ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export function isSupabaseConfigured() {
  return Boolean(url && anonKey)
}

/** Client unique — null si .env manquant */
export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured()
  ? createClient<Database>(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null

/** @deprecated Prefer `supabase` — kept for older service stubs */
export const supabaseClient = supabase

export const AUDIO_BUCKET = 'audios' as const
