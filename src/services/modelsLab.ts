import { supabase } from '@/services/supabase'

export type CompareResult = {
  ok: boolean
  model?: string
  script?: string
  usage?: { prompt: number; completion: number }
  error?: string
}

export async function compareSessionScript(
  sessionId: string,
  model: string,
): Promise<CompareResult> {
  if (!supabase) return { ok: false, error: 'Supabase non configuré' }
  const { data, error } = await supabase.functions.invoke('generate-session-audio', {
    body: { sessionId, compare: true, model },
  })
  if (error) {
    const msg = error.message || 'Appel impossible'
    return { ok: false, error: msg }
  }
  const body = data as CompareResult
  if (!body?.ok) return { ok: false, error: body?.error || 'Génération refusée' }
  return body
}
