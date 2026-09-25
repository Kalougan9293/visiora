import { isSupabaseConfigured, supabaseAdmin as supabase } from './supabase'

export type AdminUserRow = {
  id: string
  firstName: string
  email: string
  audioCount: number
  lastSeenAt: string | null
}

export type AdminSharedSession = {
  userId: string
  firstName: string
  email: string
  sessionId: string
  title: string
  answers: Record<string, unknown>
  script: string | null
  listens: number
  createdAt: string
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

  async listSharedSessions(): Promise<AdminSharedSession[]> {
    if (!isSupabaseConfigured() || !supabase) return []
    const { data, error } = await supabase.rpc('admin_list_shared_sessions')
    if (error) throw error
    return (data ?? []).map((row) => ({
      userId: row.user_id,
      firstName: row.first_name ?? '',
      email: row.email ?? '',
      sessionId: row.session_id,
      title: row.title ?? '',
      answers:
        row.answers && typeof row.answers === 'object' && !Array.isArray(row.answers)
          ? (row.answers as Record<string, unknown>)
          : {},
      script: row.script,
      listens: Number(row.listens) || 0,
      createdAt: row.created_at,
    }))
  },

  async deleteUser(userId: string): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase non configuré')
    }
    const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>(
      'admin-delete-user',
      { body: { targetId: userId } },
    )
    if (!error && data?.ok) return
    if (data?.error) throw new Error(data.error)
    const { error: rpcError } = await supabase.rpc('admin_delete_user', { target_id: userId })
    if (rpcError) throw new Error(data?.error || error?.message || rpcError.message)
  },
}
