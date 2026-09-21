import { isSupabaseConfigured, supabase } from './supabase'

export type AdminUserRow = {
  id: string
  firstName: string
  lastName: string
  email: string
  audioCount: number
  lastSeenAt: string | null
}

export type AdminStats = {
  users: number
  audios: number
  storageBytes: number
}

type RpcUser = {
  id: string
  first_name: string
  last_name: string
  email: string
  audio_count: number | string
  last_seen_at: string | null
}

type RpcStats = {
  users: number
  audios: number
  storage_bytes: number
}

export function formatStorage(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 Mo'
  const mo = bytes / (1024 * 1024)
  if (mo < 0.1) return `${Math.max(1, Math.round(bytes / 1024))} Ko`
  if (mo < 10) return `${mo.toFixed(1)} Mo`
  return `${Math.round(mo)} Mo`
}

/** Quotas Free. Audios calés sur 15 min @ 128 kbps (~14 Mo) dans 1 Go. */
export const ADMIN_LIMITS = {
  users: '50 000',
  audios: '~70',
  storage: '1 Go',
} as const

/** Comptes jetables de génération interne — pas des utilisateurs. */
function isSystemEmail(email: string) {
  return /^visiora\.gen\./i.test(email.trim())
}

function isHiddenAdminEmail(email: string) {
  const e = email.trim().toLowerCase()
  return e === 'jona_92100@hotmail.com' || e === 'jonathanvillette25@gmail.com'
}

export const adminService = {
  async loadDashboard(): Promise<{ rows: AdminUserRow[]; stats: AdminStats }> {
    if (!isSupabaseConfigured() || !supabase) {
      return {
        rows: [],
        stats: { users: 0, audios: 0, storageBytes: 0 },
      }
    }

    const [usersRes, statsRes] = await Promise.all([
      supabase.rpc('admin_list_users'),
      supabase.rpc('admin_dashboard_stats'),
    ])

    if (usersRes.error) throw usersRes.error
    if (statsRes.error) throw statsRes.error

    const rows: AdminUserRow[] = ((usersRes.data as RpcUser[] | null) ?? [])
      .map((u) => ({
        id: u.id,
        firstName: u.first_name ?? '',
        lastName: u.last_name ?? '',
        email: u.email ?? '',
        audioCount: Number(u.audio_count) || 0,
        lastSeenAt: u.last_seen_at,
      }))
      .filter((u) => !isSystemEmail(u.email) && !isHiddenAdminEmail(u.email))

    const raw = (statsRes.data as RpcStats | null) ?? {
      users: 0,
      audios: 0,
      storage_bytes: 0,
    }

    return {
      rows,
      stats: {
        users: rows.length,
        audios: rows.reduce((n, r) => n + r.audioCount, 0),
        storageBytes: Number(raw.storage_bytes) || 0,
      },
    }
  },

  async deleteUser(userId: string): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase non configuré')
    }
    const { error } = await supabase.rpc('admin_delete_user', { target_id: userId })
    if (error) throw error
  },
}
