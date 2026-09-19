import { AUDIO_BUCKET, isSupabaseConfigured, supabase } from './supabase'
import { authService } from './auth'

/**
 * Storage audios — convention : audios/{userId}/{sessionId}.mp3
 */
export const audioStorage = {
  bucket: AUDIO_BUCKET,

  pathFor(userId: string, sessionId: string, ext = 'mp3') {
    return authService.audioObjectPath(userId, sessionId, ext)
  },

  async getSignedUrl(path: string, expiresIn = 3600 * 24): Promise<string | null> {
    if (!isSupabaseConfigured() || !supabase) return null
    const { data, error } = await supabase.storage.from(AUDIO_BUCKET).createSignedUrl(path, expiresIn)
    if (error || !data?.signedUrl) {
      console.warn('[audioStorage] signed URL failed', error)
      return null
    }
    return data.signedUrl
  },

  async refreshSessionUrl(audioPath: string | null | undefined): Promise<string | null> {
    if (!audioPath) return null
    return this.getSignedUrl(audioPath)
  },
}
