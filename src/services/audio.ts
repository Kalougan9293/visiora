/**
 * Pipeline audio Visiora.
 * Démo courte : 1 invoke sync → MP3 ready (mêmes clones, sans fond).
 * Mode long : chunks + poll.
 */

import { isSupabaseConfigured, supabase } from './supabase'

export interface EnqueueAudioResult {
  ok: boolean
  accepted?: boolean
  error?: string
  orchestrated?: boolean
  status?: string
}

type InvokePayload = {
  ok?: boolean
  accepted?: boolean
  error?: string
  status?: string
  orchestrated?: boolean
}

export const audioService = {
  async enqueueGeneration(
    sessionId: string,
    opts: boolean | { force?: boolean; reset?: boolean } = false,
  ): Promise<EnqueueAudioResult> {
    if (!isSupabaseConfigured() || !supabase) {
      return { ok: false, error: 'Supabase non configuré' }
    }

    const force = typeof opts === 'boolean' ? opts : Boolean(opts.force)
    const reset = typeof opts === 'boolean' ? false : Boolean(opts.reset)

    const { data, error } = await supabase.functions.invoke<InvokePayload>(
      'generate-session-audio',
      { body: { sessionId, force, reset } },
    )

    if (data?.status === 'ready') {
      return { ok: true, accepted: true, status: 'ready' }
    }

    if (data?.status === 'failed') {
      return { ok: false, error: data.error ?? 'Génération échouée', status: 'failed' }
    }

    if (error) {
      const message =
        (data && typeof data === 'object' && data.error) || error.message || 'invoke error'
      console.warn('[audio] enqueue soft — keep polling', message)
      return { ok: true, accepted: true }
    }

    return {
      ok: true,
      accepted: true,
      status: data?.status,
      orchestrated: Boolean(data?.orchestrated),
    }
  },
}
