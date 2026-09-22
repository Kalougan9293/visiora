/** Catalogue de comparaison — prix indicatifs API, septembre 2026, $ / million de tokens. */

export type ModelProvider = 'openai' | 'anthropic'

export interface CompareModel {
  id: string
  label: string
  provider: ModelProvider
  role: string
  inputPerM: number
  outputPerM: number
}

export const COMPARE_MODELS: CompareModel[] = [
  {
    id: 'gpt-6-astra',
    label: 'GPT-6 Astra',
    provider: 'openai',
    role: 'Tête OpenAI — celle qu’il a demandée',
    inputPerM: 10,
    outputPerM: 50,
  },
  {
    id: 'gpt-5.6-sol',
    label: 'GPT-5.6 Sol',
    provider: 'openai',
    role: 'Flagship OpenAI, moins cher qu’Astra',
    inputPerM: 4,
    outputPerM: 20,
  },
  {
    id: 'claude-sonnet-5',
    label: 'Claude Sonnet 5',
    provider: 'anthropic',
    role: 'Écriture longue — le rendu qu’il connaît',
    inputPerM: 2,
    outputPerM: 10,
  },
  {
    id: 'claude-opus-5',
    label: 'Claude Opus 5',
    provider: 'anthropic',
    role: 'Tête Anthropic',
    inputPerM: 5,
    outputPerM: 25,
  },
  {
    id: 'gpt-4o-mini',
    label: 'GPT-4o mini',
    provider: 'openai',
    role: 'Repli actuel de l’app',
    inputPerM: 0.15,
    outputPerM: 0.6,
  },
]

/** Ordre de grandeur d’une séance 15 min (prompt-maître + fiche → script). */
export const ESTIMATE_IN = 6_000
export const ESTIMATE_OUT = 4_000

export function estimateUsd(model: CompareModel, inputTokens = ESTIMATE_IN, outputTokens = ESTIMATE_OUT) {
  return (inputTokens / 1_000_000) * model.inputPerM + (outputTokens / 1_000_000) * model.outputPerM
}

export function formatUsd(n: number) {
  if (n < 0.01) return `$${n.toFixed(4)}`
  return `$${n.toFixed(2)}`
}
