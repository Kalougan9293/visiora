import type { VisualizationSession } from '@/types'
import { isSupabaseConfigured, supabase } from './supabase'
import type { SessionRow } from '@/types/database'

const LOCAL_KEY = 'visiora-sessions'

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
    listens: row.listens,
  }
}

/**
 * Session persistence — localStorage fallback, Supabase `sessions` + Storage quand auth.
 */
export const sessionsService = {
  async list(userId?: string): Promise<VisualizationSession[]> {
    if (isSupabaseConfigured() && supabase && userId) {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      if (!error && data) return data.map(rowToSession)
    }
    try {
      const raw = localStorage.getItem(LOCAL_KEY)
      return raw ? (JSON.parse(raw) as VisualizationSession[]) : []
    } catch {
      return []
    }
  },

  persistLocal(sessions: VisualizationSession[]) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(sessions))
  },

  async attachAudio(_sessionId: string, _file: Blob): Promise<string | null> {
    if (!isSupabaseConfigured()) return null
    return null
  },
}
