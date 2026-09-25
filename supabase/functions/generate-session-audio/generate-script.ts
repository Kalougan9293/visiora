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
  const words = duration === 3 ? 320 : duration === 10 ? 850 : 1200
  lines.push(
    duration === 15
      ? 'Durée cible : 15 minutes. Écris entre 1 200 et 1 400 mots, avec les pauses. Va jusqu’à la fermeture. Ne t’arrête pas au milieu.'
      : `Durée cible : ${duration} minutes, environ ${words} mots.`,
  )
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

function scriptModelFromEnv(): string {
  return (
    Deno.env.get('VISIORA_SCRIPT_MODEL')?.trim() ||
    Deno.env.get('VISIORA_OPENAI_MODEL')?.trim() ||
    ''
  )
}

function preferredModels(override?: string): string[] {
  if (override?.trim()) return [override.trim()]
  const fromEnv = scriptModelFromEnv()
  if (fromEnv) return [fromEnv]
  return ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini']
}

function isAnthropicModel(model: string) {
  return model.startsWith('claude')
}

type OpenAiErrorBody = {
  error?: { message?: string; code?: string; type?: string }
}

export type ScriptUsage = { prompt: number; completion: number }

export type ScriptGenOk = { ok: true; script: string; usage?: ScriptUsage; cut?: boolean }
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
      max_tokens: 16000,
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
    choices?: { finish_reason?: string; message?: { content?: string | null } }[]
    usage?: { prompt_tokens?: number; completion_tokens?: number }
  }
  try {
    data = JSON.parse(raw) as typeof data
  } catch {
    return { ok: false, status: res.status, detail: 'réponse JSON invalide' }
  }
  const script = stripFences(data.choices?.[0]?.message?.content ?? '')
  const cut = data.choices?.[0]?.finish_reason === 'length'
  const usage =
    typeof data.usage?.prompt_tokens === 'number'
      ? { prompt: data.usage.prompt_tokens, completion: data.usage.completion_tokens ?? 0 }
      : undefined
  return { ok: true, script, usage, cut }
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
      max_tokens: 16000,
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
    stop_reason?: string
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
  const cut = data.stop_reason === 'max_tokens'
  const usage =
    typeof data.usage?.input_tokens === 'number'
      ? { prompt: data.usage.input_tokens, completion: data.usage.output_tokens ?? 0 }
      : undefined
  return { ok: true, script, usage, cut }
}

export function canGenerateScript(): boolean {
  if (!Deno.env.get('VISIORA_MASTER_PROMPT')?.trim()) return false
  const model = scriptModelFromEnv()
  if (model.startsWith('claude')) return Boolean(Deno.env.get('ANTHROPIC_API_KEY')?.trim())
  return Boolean(Deno.env.get('OPENAI_API_KEY')?.trim())
}

const SCRIPT_CLAIM_TTL_MS = 120_000

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

export function hasStoredScript(script: unknown): boolean {
  return typeof script === 'string' && script.trim().length > 40
}

function spokenWords(script: string): number {
  return script
    .replace(/\[[^\]]*\]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length
}

/** Citation ouverte, fin au milieu d’un mot, ou dernier mouvement à peine commencé. */
export function scriptIsCut(script: string): boolean {
  const text = script.trim()
  if (text.length < 80) return true
  const open = (text.match(/«/g) ?? []).length
  const close = (text.match(/»/g) ?? []).length
  if (open > close) return true
  if (!/(?:[.!?…»]|\[pause(?:\s+longue)?\])\s*$/i.test(text)) return true
  const lastMove = text.split(/\[Mouvement[^\]]*\]/i).pop()?.trim() ?? ''
  if (lastMove.length < 280) return true
  return false
}

/** Ce qui manque encore avant d’envoyer le texte à la voix. */
export function scriptFinishGaps(script: string): string[] {
  const gaps: string[] = []
  if (scriptIsCut(script)) gaps.push('coupé')
  const words = spokenWords(script)
  if (words < 1100) gaps.push(`${words} mots`)
  const pauses = (script.match(/\[pause(?:\s+longue)?\]/gi) ?? []).length
  const longs = (script.match(/\[pause longue\]/gi) ?? []).length
  if (pauses < 30 || longs < 8) gaps.push(`${pauses} pauses dont ${longs} longues`)
  if (!/si\b[\s\S]{0,160}\balors\b/i.test(script)) gaps.push('si… alors')
  const movements = (script.match(/\[Mouvement[^\]]*\]/gi) ?? []).length
  if (movements < 7) gaps.push(`${movements} mouvements`)
  const tail = script.trim().slice(-1800)
  if (!/ouvre les yeux|rouvrir les yeux/i.test(tail)) gaps.push('retour')
  return gaps
}

/** Trop court, coupé, ou sans la fermeture : on ne l’envoie pas à la voix. */
export function scriptNeedsFinish(script: string): boolean {
  return scriptFinishGaps(script).length > 0
}

const CONTINUE_PROMPT = `La séance n'est pas finie. Tu écris uniquement la suite, sans répéter le début.
Il faut le mouvement 7, l'intégration : gratitude, compte jusqu'à cinq, et une dernière phrase qui contient « ouvre les yeux ».
Ajoute le plan « si… alors… » s'il manque, avec des [pause] et [pause longue].
Garde le tutoiement, les balises [Mouvement N] et les « je » entre guillemets.
Réponds uniquement avec la suite.`

async function finishScript(
  draft: string,
  model: string,
  anthropic: boolean,
  apiKey: string,
): Promise<string> {
  let text = draft
  for (let attempt = 0; attempt < 3 && scriptNeedsFinish(text); attempt++) {
    const tail = text.trim().slice(-900)
    const userContent = `Fin actuelle du script :\n\n${tail}`
    const result = anthropic
      ? await anthropicCompletion(apiKey, model, CONTINUE_PROMPT, userContent)
      : await chatCompletion(apiKey, model, CONTINUE_PROMPT, userContent)
    if (!result.ok) break
    const extra = result.script.trim()
    if (extra.length < 40) break
    text = `${text.trim()} ${extra}`
    console.log('[generate-session-audio] script continué', spokenWords(text))
  }
  return text
}

function wordTarget(answers: SessionAnswers | null | undefined): number {
  const raw = Number(answers && typeof answers === 'object' ? answers.duration_minutes : NaN)
  const duration = raw === 3 || raw === 10 || raw === 15 ? raw : 15
  if (duration === 3) return 320
  if (duration === 10) return 850
  return 1200
}

const EXPAND_PROMPT = `Tu allonges un script de visualisation guidée Visiora, sans en changer la méthode.
Le texte reçu est trop court. Réécris-le plus développé, en gardant la même structure, les mêmes balises [pause] et les « je » entre guillemets.
Garde le tutoiement et les faits de la fiche. N’invente pas d’objectif, de date ou de symptôme.
Réponds uniquement avec le script.`

async function expandIfShort(
  answers: SessionAnswers | null | undefined,
  draft: string,
  model: string,
  anthropic: boolean,
  apiKey: string,
): Promise<string> {
  const target = wordTarget(answers)
  const before = spokenWords(draft)
  if (before >= target * 0.75) return draft
  const userContent = `${formatProfileFiche(answers)}

Script trop court (${before} mots, vise environ ${target}) :

${draft}`
  const result = anthropic
    ? await anthropicCompletion(apiKey, model, EXPAND_PROMPT, userContent)
    : await chatCompletion(apiKey, model, EXPAND_PROMPT, userContent)
  if (!result.ok || !looksLikeSessionScript(result.script)) return draft
  if (spokenWords(result.script) <= before) return draft
  console.log('[generate-session-audio] script allongé', spokenWords(result.script))
  return result.script
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
    const expanded = await expandIfShort(answers, result.script, model, anthropic, apiKey)
    const script = await finishScript(expanded, model, anthropic, apiKey)
    const gaps = scriptFinishGaps(script)
    if (gaps.length) {
      console.error('[generate-session-audio] script incomplet', gaps.join(', '))
      throw new Error(`Génération script : fin incomplète (${gaps.join(', ')}), audio non lancé`)
    }
    console.log('[generate-session-audio] script complet', spokenWords(script), 'mots')
    return { script, model, usage: result.usage }
  }

  throw new Error(`Génération script : ${lastDetail}`)
}

export async function generateSessionScript(answers: SessionAnswers | null | undefined): Promise<string> {
  const result = await generateSessionScriptDetailed(answers)
  return result.script
}
