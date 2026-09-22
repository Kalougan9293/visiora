/** Génère le script de séance via le prompt-maître (secret) + les réponses. */

export type SessionAnswers = Record<string, unknown>

const Q_LABELS: { key: string; label: string; optional?: boolean }[] = [
  { key: 'q1', label: 'Q1  Objectif précis' },
  { key: 'q2', label: 'Q2  Échéance' },
  { key: 'q3', label: 'Q3  Pourquoi c\'est important maintenant' },
  { key: 'q4', label: 'Q4  Scène de réussite' },
  { key: 'q5', label: 'Q5  Émotion cible' },
  { key: 'q6', label: 'Q6  État actuel' },
  { key: 'q7', label: 'Q7  Obstacle + recadrage souhaité' },
  { key: 'q8', label: 'Q8  Blocage physique', optional: true },
  { key: 'q9', label: 'Q9  Ce que l\'utilisateur met déjà en place' },
  { key: 'q10', label: 'Q10 Micro-action concrète' },
  { key: 'q11', label: 'Q11 Croyance cible' },
  { key: 'q13', label: 'Q13 Prénom', optional: true },
]

function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean).join(', ')
  return ''
}

function q12Line(answers: SessionAnswers): string {
  const registre = asText(answers.q12_registre)
  const voice = asText(answers.q12_voice)
  const tu = 'tutoiement'
  const reg =
    registre === 'spirituel'
      ? 'spirituel ouvert'
      : registre === 'metaphysique'
        ? 'entre les deux'
        : 'laïc'
  const parts = [`formulation : ${tu}`, `registre : ${reg}`]
  if (voice) parts.unshift(`voix : ${voice}`)
  return `Q12 ${parts.join(' · ')}`
}

/** Message utilisateur uniquement — jamais le prompt-maître. */
export function formatProfileFiche(answers: SessionAnswers | null | undefined): string {
  const src = answers && typeof answers === 'object' ? answers : {}
  const lines: string[] = ['Fiche profil utilisateur :', '']
  for (const row of Q_LABELS) {
    const value = asText(src[row.key])
    if (!value) {
      if (row.optional) continue
      continue
    }
    lines.push(`${row.label} : ${value}`)
  }
  lines.push(q12Line(src))
  const durationRaw = Number(src.duration_minutes)
  const duration = durationRaw === 3 || durationRaw === 10 || durationRaw === 15 ? durationRaw : 15
  lines.push(`Durée cible de la séance : ${duration} minutes. Calibre le texte et les pauses pour tenir ce timing.`)
  lines.push('')
  lines.push('Génère le script de séance pour ce profil.')
  return lines.join('\n')
}

function stripFences(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:[\w-]+)?\s*([\s\S]*?)\s*```$/)
  return (fenced?.[1] ?? trimmed).trim()
}

function looksLikeSessionScript(text: string): boolean {
  if (text.length > 400) return true
  return text.length > 80 && (/\[Mouvement/i.test(text) || /\[pause/i.test(text))
}

function preferredModels(override?: string): string[] {
  if (override?.trim()) return [override.trim()]
  const fromEnv = Deno.env.get('VISIORA_OPENAI_MODEL')?.trim()
  const list = [fromEnv, 'gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini']
  return [...new Set(list.filter((m): m is string => Boolean(m)))]
}

function isAnthropicModel(model: string) {
  return model.startsWith('claude')
}

type OpenAiErrorBody = {
  error?: { message?: string; code?: string; type?: string }
}

export type ScriptUsage = { prompt: number; completion: number }

export type ScriptGenOk = { ok: true; script: string; usage?: ScriptUsage }
export type ScriptGenFail = { ok: false; status: number; detail: string }

async function chatCompletion(
  apiKey: string,
  model: string,
  prompt: string,
  userContent: string,
): Promise<ScriptGenOk | ScriptGenFail> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      max_tokens: 8000,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: userContent },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  })

  const raw = await res.text().catch(() => '')
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const parsed = JSON.parse(raw) as OpenAiErrorBody
      const msg = parsed.error?.message ?? parsed.error?.code
      if (msg) detail = `${res.status} ${msg}`.slice(0, 180)
    } catch {
      if (raw) detail = `${res.status} ${raw}`.slice(0, 180)
    }
    return { ok: false, status: res.status, detail }
  }

  let data: {
    choices?: { message?: { content?: string | null } }[]
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  try {
    data = JSON.parse(raw) as typeof data
  } catch {
    return { ok: false, status: res.status, detail: 'réponse JSON invalide' }
  }
  const script = stripFences(data.choices?.[0]?.message?.content ?? '')
  const usage =
    typeof data.usage?.prompt_tokens === 'number'
      ? { prompt: data.usage.prompt_tokens, completion: data.usage.completion_tokens ?? 0 }
      : undefined
  return { ok: true, script, usage }
}

async function anthropicCompletion(
  apiKey: string,
  model: string,
  prompt: string,
  userContent: string,
): Promise<ScriptGenOk | ScriptGenFail> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8000,
      system: prompt,
      messages: [{ role: 'user', content: userContent }],
    }),
    signal: AbortSignal.timeout(90_000),
  })
  const raw = await res.text().catch(() => '')
  if (!res.ok) {
    return { ok: false, status: res.status, detail: `${res.status} ${raw}`.slice(0, 180) }
  }
  let data: {
    content?: { type?: string; text?: string }[]
    usage?: { input_tokens?: number; output_tokens?: number }
  }
  try {
    data = JSON.parse(raw) as typeof data
  } catch {
    return { ok: false, status: res.status, detail: 'réponse JSON invalide' }
  }
  const text = data.content?.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('\n') ?? ''
  const script = stripFences(text)
  const usage =
    typeof data.usage?.input_tokens === 'number'
      ? { prompt: data.usage.input_tokens, completion: data.usage.output_tokens ?? 0 }
      : undefined
  return { ok: true, script, usage }
}

export function canGenerateScript(): boolean {
  return Boolean(
    Deno.env.get('VISIORA_MASTER_PROMPT')?.trim() && Deno.env.get('OPENAI_API_KEY')?.trim(),
  )
}

const SCRIPT_CLAIM_TTL_MS = 120_000
const DEMO_CLAIM_TTL_MS = 180_000

function isPhaseClaim(job: unknown, phase: string, ttlMs: number): boolean {
  if (!job || typeof job !== 'object') return false
  const v = job as { phase?: string; claimedAt?: string }
  if (v.phase !== phase || typeof v.claimedAt !== 'string') return false
  const age = Date.now() - new Date(v.claimedAt).getTime()
  return Number.isFinite(age) && age >= 0 && age < ttlMs
}

export function isScriptInProgress(job: unknown): boolean {
  return isPhaseClaim(job, 'scripting', SCRIPT_CLAIM_TTL_MS)
}

export function isDemoInProgress(job: unknown): boolean {
  return isPhaseClaim(job, 'demo', DEMO_CLAIM_TTL_MS)
}

const N8N_QUEUE_TTL_MS = 40 * 60 * 1000

export function isN8nQueued(job: unknown): boolean {
  return isPhaseClaim(job, 'n8n', N8N_QUEUE_TTL_MS)
}

export function n8nQueuePayload(): { phase: 'n8n'; claimedAt: string } {
  return { phase: 'n8n', claimedAt: new Date().toISOString() }
}

export function scriptClaimPayload(): { phase: 'scripting'; claimedAt: string } {
  return { phase: 'scripting', claimedAt: new Date().toISOString() }
}

export function demoClaimPayload(): { phase: 'demo'; claimedAt: string } {
  return { phase: 'demo', claimedAt: new Date().toISOString() }
}

export function hasStoredScript(script: unknown): boolean {
  return typeof script === 'string' && script.trim().length > 40
}

export async function generateSessionScriptDetailed(
  answers: SessionAnswers | null | undefined,
  modelOverride?: string,
): Promise<{ script: string; model: string; usage?: ScriptUsage }> {
  const prompt = Deno.env.get('VISIORA_MASTER_PROMPT')?.trim() ?? ''
  if (!prompt) throw new Error('Génération script : secrets manquants')

  const userContent = formatProfileFiche(answers)
  const models = preferredModels(modelOverride)
  let lastDetail = 'aucun modèle tenté'

  for (const model of models) {
    const anthropic = isAnthropicModel(model)
    const apiKey = anthropic
      ? Deno.env.get('ANTHROPIC_API_KEY')?.trim() ?? ''
      : Deno.env.get('OPENAI_API_KEY')?.trim() ?? ''
    if (!apiKey) {
      lastDetail = `${model}: clé ${anthropic ? 'Anthropic' : 'OpenAI'} manquante`
      if (modelOverride) throw new Error(`Génération script : ${lastDetail}`)
      continue
    }
    const result = anthropic
      ? await anthropicCompletion(apiKey, model, prompt, userContent)
      : await chatCompletion(apiKey, model, prompt, userContent)
    if (!result.ok) {
      lastDetail = `${model}: ${result.detail}`
      console.error('[generate-session-audio] llm', lastDetail)
      const retryable = result.status === 404 || result.status === 403
      if (retryable && !modelOverride) continue
      throw new Error(`Génération script : ${result.detail}`)
    }
    if (!looksLikeSessionScript(result.script)) {
      lastDetail = `${model}: sortie trop courte`
      console.error('[generate-session-audio] llm', lastDetail)
      if (modelOverride) throw new Error(`Génération script : ${lastDetail}`)
      continue
    }
    console.log('[generate-session-audio] script ok', model, result.script.length)
    return { script: result.script, model, usage: result.usage }
  }

  throw new Error(`Génération script : ${lastDetail}`)
}

export async function generateSessionScript(answers: SessionAnswers | null | undefined): Promise<string> {
  const result = await generateSessionScriptDetailed(answers)
  return result.script
}
