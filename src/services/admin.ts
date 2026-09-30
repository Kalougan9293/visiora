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
export type TesterNote = {
  scale: number
  createdAt: string
  remark: string | null
}

export type TesterPlay = {
  id: string
  startedAt: string
  maxSeconds: number
  durationSeconds: number
  completed: boolean
}

export type TesterSession = {
  id: string
  title: string
  createdAt: string
  status: string
  voiceId: string | null
  register: string | null
  fileBytes: number | null
  scaleBefore: number | null
  promptVersion: string | null
  scriptWords: number | null
  generationSeconds: number | null
  error: string | null
  listenedSeconds: number | null
  estimatedSeconds: number | null
  notes: TesterNote[]
  plays: TesterPlay[]
}

export type ProviderMeter =
  | { status: 'ready'; characters: number; limit: number | null }
  | { status: 'missing' }
  | { status: 'error' }

export type AnthropicMeter =
  | { status: 'ready'; usd: number }
  | { status: 'missing' }
  | { status: 'error' }

export type ProviderUsage = {
  eleven: ProviderMeter
  anthropic: AnthropicMeter
}

export type TesterUser = {
  id: string
  firstName: string
  email: string
  createdAt: string
  lastSeenAt: string | null
  share: boolean
  clientLabel: string | null
  sessionCount: number
  listenCount: number
  practiceDays: number
  storageBytes: number
  sessions: TesterSession[]
}

export type TesterOverview = {
  active7d: number
  created: number
  failed: number
  completeRate: number | null
  scoreGap: number | null
  generationSeconds: number | null
}

export type TesterFollow = {
  overview: TesterOverview
  users: TesterUser[]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function numOrNull(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function parseTesterFollow(payload: unknown): TesterFollow {
  const root = asRecord(payload)
  const people = asArray(root?.users)
    .map(asRecord)
    .filter((row): row is Record<string, unknown> => Boolean(row))
    .filter((row) => {
      const email = String(row.email ?? '')
      return !isSystemEmail(email) && !isHiddenAdminEmail(email)
    })
  const allowed = new Set(people.map((row) => String(row.id)))

  const playsBySession = new Map<string, TesterPlay[]>()
  for (const raw of asArray(root?.plays)) {
    const row = asRecord(raw)
    if (!row || !allowed.has(String(row.user_id ?? ''))) continue
    const sessionId = String(row.session_id ?? '')
    const list = playsBySession.get(sessionId) ?? []
    list.push({
      id: String(row.id ?? ''),
      startedAt: String(row.started_at ?? ''),
      maxSeconds: numOrNull(row.max_seconds) ?? 0,
      durationSeconds: numOrNull(row.duration_seconds) ?? 0,
      completed: row.completed === true,
    })
    playsBySession.set(sessionId, list)
  }

  const sessionsByUser = new Map<string, TesterSession[]>()
  for (const raw of asArray(root?.sessions)) {
    const row = asRecord(raw)
    if (!row || !allowed.has(String(row.user_id ?? ''))) continue
    const userId = String(row.user_id)
    const session: TesterSession = {
      id: String(row.id ?? ''),
      title: String(row.title ?? ''),
      createdAt: String(row.created_at ?? ''),
      status: String(row.status ?? ''),
      voiceId: textOrNull(row.voice_id),
      register: textOrNull(row.register),
      fileBytes: numOrNull(row.file_bytes),
      scaleBefore: numOrNull(row.scale_before),
      promptVersion: textOrNull(row.prompt_version),
      scriptWords: numOrNull(row.script_words),
      generationSeconds: numOrNull(row.generation_seconds),
      error: textOrNull(row.error),
      listenedSeconds: numOrNull(row.listened_seconds),
      estimatedSeconds: numOrNull(row.estimated_seconds),
      notes: asArray(row.notes).flatMap((item) => {
        const note = asRecord(item)
        const scale = note ? numOrNull(note.scale) : null
        if (!note || scale == null) return []
        return [{
          scale,
          createdAt: String(note.created_at ?? ''),
          remark: textOrNull(note.remark),
        }]
      }),
      plays: playsBySession.get(String(row.id ?? '')) ?? [],
    }
    const list = sessionsByUser.get(userId) ?? []
    list.push(session)
    sessionsByUser.set(userId, list)
  }

  const users: TesterUser[] = people.map((row) => ({
    id: String(row.id),
    firstName: String(row.first_name ?? ''),
    email: String(row.email ?? ''),
    createdAt: String(row.created_at ?? ''),
    lastSeenAt: textOrNull(row.last_seen_at),
    share: row.share_sessions === true,
    clientLabel: textOrNull(row.client_label),
    sessionCount: numOrNull(row.session_count) ?? 0,
    listenCount: numOrNull(row.listen_count) ?? 0,
    practiceDays: numOrNull(row.practice_days) ?? 0,
    storageBytes: numOrNull(row.storage_bytes) ?? 0,
    sessions: sessionsByUser.get(String(row.id)) ?? [],
  }))

  return { overview: buildOverview(users), users }
}

function buildOverview(users: TesterUser[]): TesterOverview {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const sessions = users.flatMap((user) => user.sessions)
  const plays = sessions.flatMap((session) => session.plays)
  const gaps: number[] = []
  for (const session of sessions) {
    if (session.scaleBefore == null) continue
    for (const note of session.notes) gaps.push(note.scale - session.scaleBefore)
  }
  const generations = sessions
    .map((session) => session.generationSeconds)
    .filter((value): value is number => value != null)
  const mean = (values: number[]) =>
    values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null

  return {
    active7d: users.filter((user) => {
      if (!user.lastSeenAt) return false
      const at = new Date(user.lastSeenAt).getTime()
      return Number.isFinite(at) && at >= weekAgo
    }).length,
    created: sessions.length,
    failed: sessions.filter((session) => session.status === 'failed').length,
    completeRate: plays.length ? plays.filter((play) => play.completed).length / plays.length : null,
    scoreGap: mean(gaps),
    generationSeconds: mean(generations),
  }
}

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

  async loadTesterFollow(): Promise<{ data: TesterFollow | null; missing: boolean }> {
    if (!isSupabaseConfigured() || !supabase) return { data: null, missing: true }
    const { data, error } = await supabase.rpc('admin_follow_testers')
    if (error) {
      const message = error.message ?? ''
      if (/admin_follow_testers|PGRST202|schema cache|does not exist|Could not find the function/i.test(message)) {
        return { data: null, missing: true }
      }
      throw error
    }
    return { data: parseTesterFollow(data), missing: false }
  },

  async loadProviderUsage(): Promise<ProviderUsage | null> {
    if (!isSupabaseConfigured() || !supabase) return null
    const { data, error } = await supabase.functions.invoke<ProviderUsage>('admin-provider-usage', {
      body: {},
    })
    if (error || !data?.eleven || !data?.anthropic) return null
    return data
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
