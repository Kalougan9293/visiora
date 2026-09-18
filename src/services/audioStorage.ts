import { AUDIO_BUCKET, isSupabaseConfigured, supabase } from './supabase'
import { authService } from './auth'

/**
 * Préparation Storage audios — upload réel + garde-fous plus tard.
 * Convention : audios/{userId}/{sessionId}.mp3
 */
export const audioStorage = {
  bucket: AUDIO_BUCKET,

  pathFor(userId: string, sessionId: string, ext = 'mp3') {
    return authService.audioObjectPath(userId, sessionId, ext)
  },

  async upload(_userId: string, _sessionId: string, _file: Blob): Promise<{
    path: string | null
    bytes: number | null
    error: string | null
  }> {
    if (!isSupabaseConfigured() || !supabase) {
      return { path: null, bytes: null, error: 'Supabase non configuré' }
    }
    // TODO: upload + limites taille / mime / quota
    return { path: null, bytes: null, error: 'Upload audio pas encore branché' }
  },

  async getSignedUrl(_path: string, _expiresIn = 3600): Promise<string | null> {
    if (!isSupabaseConfigured() || !supabase) return null
    // TODO: createSignedUrl
    return null
  },
}
