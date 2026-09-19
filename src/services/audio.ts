/**
 * Pipeline audio Visiora.
 * Le front déclenche le job et lit le statut en base.
 * Jamais de TTS live côté client à la lecture.
 */

import { isSupabaseConfigured, supabase } from './supabase'

export interface EnqueueAudioResult {
  ok: boolean
  accepted?: boolean
  error?: string
}

type InvokePayload = {
  ok?: boolean
  accepted?: boolean
  error?: string
  status?: string
}

function looksLikeTimeout(message: string): boolean {
  return /timeout|timed out|504|546|network/i.test(message)
}

export const audioService = {
  /**
   * Démarre le traitement audio (réponse 202). Le MP3 arrive plus tard en base.
   */
  async enqueueGeneration(sessionId: string, force = false): Promise<EnqueueAudioResult> {
    if (!isSupabaseConfigured() || !supabase) {
      return { ok: false, error: 'Supabase non configuré' }
    }

    const { data, error } = await supabase.functions.invoke<InvokePayload>(
      'generate-session-audio',
      { body: { sessionId, force } },
    )

    if (error) {
      const fromBody = data && typeof data === 'object' ? data.error : undefined
      const message = fromBody || error.message
      if (looksLikeTimeout(message)) {
        return { ok: true, accepted: true }
      }
      console.warn('[audio] enqueue failed', error, data)
      return { ok: false, error: message }
    }

    if (data?.status === 'failed' || data?.error) {
      return { ok: false, error: data.error ?? 'Génération échouée' }
    }

    return { ok: true, accepted: true }
  },
}
