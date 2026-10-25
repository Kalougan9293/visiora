import { distressScanText, findDistressMatches } from '@/services/healthGate'
import { isSupabaseConfigured, supabase } from '@/services/supabase'

export type DistressEvaluation = {
  /** Afficher l’écran bienveillant (non bloquant). */
  show: boolean
  matches: string[]
  /** local | claude | fallback | none */
  source: string
}

/**
 * 1) Expressions entières dans toutes les réponses texte.
 * 2) Si match → confirmation Claude (oui seulement si intention claire ; doute = non).
 */
export async function evaluateDistress(
  answers: Record<string, unknown>,
  keywords: readonly string[],
): Promise<DistressEvaluation> {
  const matches = findDistressMatches(answers, keywords)
  if (!matches.length) {
    return { show: false, matches: [], source: 'none' }
  }

  console.info('[distress] expressions détectées:', matches.join(', '))

  if (!isSupabaseConfigured() || !supabase) {
    console.info('[distress] pas de Supabase → pas d’écran (doute)')
    return { show: false, matches, source: 'local' }
  }

  const text = distressScanText(answers)
  try {
    const { data, error } = await supabase.functions.invoke<{
      confirmed?: boolean
      source?: string
      error?: string
    }>('confirm-distress', {
      method: 'POST',
      body: { text, matches },
    })
    if (error) {
      console.warn('[distress] confirm-distress', error.message)
      return { show: false, matches, source: 'fallback' }
    }
    if (data?.error) {
      console.warn('[distress] confirm-distress', data.error)
      return { show: false, matches, source: 'fallback' }
    }
    const confirmed = data?.confirmed === true
    const source = data?.source ?? 'claude'
    console.info(
      '[distress] confirmation',
      confirmed ? 'oui → écran apaisement' : 'non → on continue',
      `(${source})`,
    )
    return { show: confirmed, matches, source }
  } catch (err) {
    console.warn('[distress] confirm-distress', err)
    return { show: false, matches, source: 'fallback' }
  }
}
