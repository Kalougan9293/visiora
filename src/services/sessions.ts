import type { VisualizationAnswers, VisualizationSession } from '@/types'
import { normalizeDuration } from '@/lib/sessionDuration'
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

function durationFromAnswers(answers: VisualizationAnswers): number {
  return normalizeDuration(answers.duration_minutes)
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

/**
 * Session persistence — Supabase `sessions` (compte requis).
 */
export const sessionsService = {
  titleFromAnswers,
  durationFromAnswers,
  voiceFromAnswers,

  async list(userId?: string): Promise<VisualizationSession[]> {
    if (!userId) return []
    if (isSupabaseConfigured() && supabase) {
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
    return []
  },

  async get(id: string, userId?: string): Promise<VisualizationSession | null> {
    if (!userId) return null
    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle()
      if (!error && data) return withFreshAudioUrl(rowToSession(data))
    }
    return null
  },

  clearLocal() {
    localStorage.removeItem(LOCAL_KEY)
  },

  async create(answers: VisualizationAnswers, userId?: string): Promise<VisualizationSession> {
    if (!userId) throw new Error('Connexion requise pour créer une séance')
    const now = new Date().toISOString()
    const title = titleFromAnswers(answers)
    const durationMinutes = durationFromAnswers(answers)
    const voiceId = voiceFromAnswers(answers)
    const status = 'generating' as const

    if (isSupabaseConfigured() && supabase) {
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
          audio_bytes: 5,
          listens: 0,
          health_ack_at: healthAckAt,
        })
        .select('*')
        .single()

      if (!error && data) return rowToSession(data)
      console.warn('[sessions] insert failed', error)
      throw error ?? new Error('Impossible de créer la séance')
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

  async adjust(
    id: string,
    answers: VisualizationAnswers,
    userId: string,
    keepTitle: string,
  ): Promise<VisualizationSession> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Connexion requise pour ajuster une séance')
    }
    const durationMinutes = durationFromAnswers(answers)
    const voiceId = voiceFromAnswers(answers)
    const { data, error } = await supabase
      .from('sessions')
      .update({
        answers,
        title: keepTitle,
        duration_minutes: durationMinutes,
        voice_id: voiceId,
        script: null,
        audio_job: null,
        audio_path: null,
        audio_url: null,
        status: 'generating',
        audio_bytes: 5,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single()
    if (error || !data) throw error ?? new Error('Impossible d’ajuster la séance')
    try {
      await audioStorage.clearGenerated(userId, id)
    } catch (err) {
      console.warn('[sessions] clear audio after adjust', err)
    }
    return rowToSession(data)
  },

  async listListenDays(userId?: string): Promise<{ dates: string[]; count: number } | null> {
    if (!userId || !isSupabaseConfigured() || !supabase) return null
    const { data, error } = await supabase
      .from('listens')
      .select('listened_on')
      .eq('user_id', userId)
    if (error || !data) {
      if (error) console.warn('[sessions] listens', error.message)
      return null
    }
    return {
      dates: data.map((row) => String(row.listened_on)).filter(Boolean),
      count: data.length,
    }
  },

  async markListened(id: string, nextListens: number, userId?: string): Promise<boolean> {
    if (isSupabaseConfigured() && supabase && userId) {
      const { data, error } = await supabase.rpc('record_listen', { p_session_id: id })
      if (!error) return Boolean(data)
      /** Fallback si la migration listens n’est pas encore appliquée */
      console.warn('[sessions] record_listen fallback', error.message)
      const { data: row } = await supabase
        .from('sessions')
        .select('listens')
        .eq('id', id)
        .eq('user_id', userId)
        .maybeSingle()
      const next = Math.max(nextListens, (Number(row?.listens) || 0) + 1)
      const { error: upErr } = await supabase
        .from('sessions')
        .update({ listens: next, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId)
      if (upErr) throw upErr
      return true
    }
    return true
  },
}
