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

  async downloadMp3(url: string, filename: string): Promise<void> {
    if (!url) return
    const name = filename.endsWith('.mp3') ? filename : `${filename}.mp3`
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Téléchargement ${res.status}`)
      const blob = await res.blob()
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      a.download = name
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(href)
    } catch (err) {
      console.warn('[audioStorage] download blob failed, open url', err)
      window.open(url, '_blank', 'noopener')
    }
  },

  async clearGenerated(userId: string, sessionId: string): Promise<void> {
    if (!isSupabaseConfigured() || !supabase) return
    const partsPrefix = `${userId}/${sessionId}/parts`
    const { data } = await supabase.storage.from(AUDIO_BUCKET).list(partsPrefix, { limit: 1000 })
    const paths = (data ?? []).map((f) => `${partsPrefix}/${f.name}`)
    paths.push(`${userId}/${sessionId}.mp3`)
    if (!paths.length) return
    const { error } = await supabase.storage.from(AUDIO_BUCKET).remove(paths)
    if (error) console.warn('[audioStorage] clearGenerated', error.message)
  },
}
