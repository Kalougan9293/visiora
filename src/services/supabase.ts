import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL ?? ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

export function isSupabaseConfigured() {
  return Boolean(url && anonKey)
}

const APP_AUTH_KEY = 'visiora-app-auth'
const ADMIN_AUTH_KEY = 'visiora-admin-auth'

/** Lien de réinitialisation uniquement. Un lien d’app ne doit jamais ouvrir un compte. */
function isPasswordRecoveryUrl() {
  if (typeof window === 'undefined') return false
  const path = window.location.pathname.replace(/\/$/, '')
  return path === '/nouveau-mot-de-passe'
}

/** Jeton collé dans l’adresse : on l’ignore hors page de mot de passe. */
function stripLeakedAuthParams() {
  if (typeof window === 'undefined' || isPasswordRecoveryUrl()) return
  const next = new URL(window.location.href)
  let dirty = false
  for (const key of ['code', 'access_token', 'refresh_token', 'token_hash', 'type']) {
    if (next.searchParams.has(key)) {
      next.searchParams.delete(key)
      dirty = true
    }
  }
  if (/access_token|refresh_token|token_hash|^#?code=/.test(next.hash)) {
    next.hash = ''
    dirty = true
  }
  if (!dirty) return
  const search = next.searchParams.toString()
  window.history.replaceState(null, '', `${next.pathname}${search ? `?${search}` : ''}${next.hash}`)
}

/** Ancienne clé unique sb-… : elle mélangeait le compte app et le compte admin. */
function clearLegacyAuthStorage() {
  if (typeof window === 'undefined') return
  try {
    const drop: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('sb-') && key.includes('auth-token')) drop.push(key)
    }
    for (const key of drop) localStorage.removeItem(key)
  } catch {
    /* stockage indisponible */
  }
}

stripLeakedAuthParams()
clearLegacyAuthStorage()

function createAuthClient(storageKey: string, detectSessionInUrl: boolean) {
  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl,
      storageKey,
      flowType: 'pkce',
    },
  })
}

/** Session de l’app. Jamais celle de /admin. */
export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured()
  ? createAuthClient(APP_AUTH_KEY, isPasswordRecoveryUrl())
  : null

/** Session admin, coffre séparé. Se connecter ici ne change pas le compte de l’app. */
export const supabaseAdmin: SupabaseClient<Database> | null = isSupabaseConfigured()
  ? createAuthClient(ADMIN_AUTH_KEY, false)
  : null

export const AUDIO_BUCKET = 'audios' as const
