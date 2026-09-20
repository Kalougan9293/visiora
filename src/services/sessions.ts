import type { VisualizationAnswers, VisualizationSession } from '@/types'
import { audioStorage } from './audioStorage'
import { isSupabaseConfigured, supabase } from './supabase'
import type { SessionRow } from '@/types/database'

const LOCAL_KEY = 'visiora-sessions'

function voiceFromAnswers(answers: VisualizationAnswers): string | null {
  const v = answers.q12_voice
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

function titleFromAnswers(answers: VisualizationAnswers): string {
  const q1 = answers.q1
  if (typeof q1 === 'string' && q1.trim()) {
    return q1.trim().slice(0, 42) + (q1.trim().length > 42 ? '…' : '')
  }
  return 'Séance personnalisée'
}

function durationFromAnswers(_answers: VisualizationAnswers): number {
  return 15
}

function progressFromRow(row: SessionRow): number {
  if (row.status === 'ready') return 100
  if (row.status !== 'generating') return 0
  const raw = Number(row.audio_bytes)
  if (Number.isFinite(raw) && raw > 0 && raw <= 100) return Math.round(raw)
  return 8
}

function rowToSession(row: SessionRow): VisualizationSession {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    durationMinutes: row.duration_minutes,
    answers: (row.answers as VisualizationSession['answers']) ?? {},
    status: row.status,
    audioUrl: row.audio_url,
    audioStoragePath: row.audio_path,
    audioProgress: progressFromRow(row),
    listens: row.listens,
    script: row.script ?? null,
  }
}

async function withFreshAudioUrl(session: VisualizationSession): Promise<VisualizationSession> {
  if (!session.audioStoragePath) return session
  const url = await audioStorage.refreshSessionUrl(session.audioStoragePath)
  return url ? { ...session, audioUrl: url } : session
}

function readLocal(): VisualizationSession[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? (JSON.parse(raw) as VisualizationSession[]) : []
  } catch {
    return []
  }
}

/**
 * Session persistence — localStorage (invité) ou Supabase `sessions` (connecté).
 */
export const sessionsService = {
  titleFromAnswers,
  durationFromAnswers,
  voiceFromAnswers,

  async list(userId?: string): Promise<VisualizationSession[]> {
    if (isSupabaseConfigured() && supabase && userId) {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (!error && data) {
        const mapped = data.map(rowToSession)
        return Promise.all(mapped.map(withFreshAudioUrl))
      }
    }
    return readLocal()
  },

  async get(id: string, userId?: string): Promise<VisualizationSession | null> {
    if (isSupabaseConfigured() && supabase && userId) {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle()
      if (!error && data) return withFreshAudioUrl(rowToSession(data))
    }
    return readLocal().find((s) => s.id === id) ?? null
  },

  persistLocal(sessions: VisualizationSession[]) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(sessions))
  },

  async create(answers: VisualizationAnswers, userId?: string): Promise<VisualizationSession> {
    const now = new Date().toISOString()
    const title = titleFromAnswers(answers)
    const durationMinutes = durationFromAnswers(answers)
    const voiceId = voiceFromAnswers(answers)
    /** Connecté → génération audio prévue ; invité → brouillon local sans TTS */
    const status = userId ? 'generating' : 'draft'

    if (isSupabaseConfigured() && supabase && userId) {
      const healthAckAt =
        typeof answers.health_ack_at === 'string' ? answers.health_ack_at : null
      const { data, error } = await supabase
        .from('sessions')
        .insert({
          user_id: userId,
          title,
          answers,
          status,
          duration_minutes: durationMinutes,
          voice_id: voiceId,
          audio_bytes: status === 'generating' ? 5 : null,
          listens: 0,
          health_ack_at: healthAckAt,
        })
        .select('*')
        .single()

      if (!error && data) return rowToSession(data)
      console.warn('[sessions] insert failed, fallback local', error)
    }

    return {
      id: crypto.randomUUID(),
      userId,
      title,
      createdAt: now,
      updatedAt: now,
      durationMinutes,
      answers,
      status: 'draft',
      audioUrl: null,
      listens: 0,
    }
  },

  async patchLocal(
    id: string,
    patch: Partial<VisualizationSession>,
    sessions: VisualizationSession[],
  ): Promise<VisualizationSession[]> {
    return sessions.map((s) => (s.id === id ? { ...s, ...patch, updatedAt: new Date().toISOString() } : s))
  },

  async remove(id: string, userId?: string): Promise<void> {
    if (isSupabaseConfigured() && supabase && userId) {
      const { error } = await supabase.from('sessions').delete().eq('id', id).eq('user_id', userId)
      if (error) throw error
    }
  },

  async markListened(id: string, nextListens: number, userId?: string): Promise<boolean> {
    if (isSupabaseConfigured() && supabase && userId) {
      const { data, error } = await supabase.rpc('record_listen', { p_session_id: id })
      if (!error) return Boolean(data)
      /** Fallback si la migration listens n’est pas encore appliquée */
      console.warn('[sessions] record_listen fallback', error.message)
      const { error: upErr } = await supabase
        .from('sessions')
        .update({ listens: nextListens, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId)
      if (upErr) throw upErr
      return true
    }
    return true
  },
}
