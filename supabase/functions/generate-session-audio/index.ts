import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import {
  createAudioJob,
  isAudioJob,
  partPath,
  progressPct,
  PROMPT_VERSION,
  concatBytes,
  speechTextAt,
  type AudioJob,
  type JobStep,
} from './job.ts'
import { resolveScript } from './script.ts'
import {
  canGenerateScript,
  suggestSessionTitle,
  generateSessionScriptDetailed,
  spokenWords,
  hasStoredScript,
  n8nQueueAgeMs,
  isScriptInProgress,
  n8nQueuePayload,
  scriptClaimPayload,
} from './generate-script.ts'
import {
  TTS_PCM_FORMAT,
  upsampleTts,
  encodeMp3,
  createMp3Stream,
  withAiDisclosureTag,
  pcmFromEleven,
  pcmFromWav,
  pcmToWav,
  silencePcm,
  loadBed,
  mixLoopingBed,
  levelSpeech,
  fadeSeam,
} from './mix.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-visiora-orchestrator-secret',
}

const DEFAULT_VOICES: Record<string, string> = {
  rituel: '1zaEYJSYmxoQNiDl5C42',
  antoni: 'iYo3urNKUm5TVGCFojl0',
  onde: 'CfDJFNP9FItBtQcWKTwh',
  louis: 'vBvYVsqjPzJc9Od66elb',
  aurore: 'ucMmKRQbfDEYyb2IIGax',
  maelis: 'x10MLxaAmShMYt7vs7pl',
  rachel: 'zPy2sgLU4pZ7Xrjh87uz',
  bella: 'EXAVITQu4vr4xnSDxMaL',
}

/** Autre invoke en cours : ne pas double-traiter le même step. */
const CLAIM_TTL_MS = 45_000
const MIX_RATE = 44100
/** Une passe encode au plus ~12 s : plafond CPU de 2 s sur l’Edge Function. */
const MIX_SLICE_SOFT = 10 * MIX_RATE
const MIX_SLICE_CAP = 12 * MIX_RATE
/** Deux blocs voix par passage, l’un après l’autre, pour garder la même voix sans dépasser le délai de l’orchestrateur. */
const PARALLEL_SPEECH = 2

function elevenModelId(): string {
  return Deno.env.get('VISIORA_ELEVEN_MODEL')?.trim() || 'eleven_multilingual_v2'
}

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void } | undefined

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Mesure d’usage. Si la colonne n’existe pas encore, la génération continue. */
async function noteUsage(
  admin: SupabaseClient,
  sessionId: string,
  patch: Record<string, unknown>,
) {
  const { data, error: readErr } = await admin
    .from('sessions')
    .select('usage')
    .eq('id', sessionId)
    .maybeSingle()
  if (readErr) return
  const prev = data?.usage && typeof data.usage === 'object' && !Array.isArray(data.usage)
    ? data.usage as Record<string, unknown>
    : {}
  const { error } = await admin
    .from('sessions')
    .update({ usage: { ...prev, ...patch } })
    .eq('id', sessionId)
  if (error) console.warn('[generate-session-audio] usage', error.message)
}

async function saveGeneratedScript(
  admin: SupabaseClient,
  sessionId: string,
  answers: unknown,
): Promise<string> {
  const fiche = answers && typeof answers === 'object' ? (answers as Record<string, unknown>) : {}
  const generated = await generateSessionScriptDetailed(fiche)
  let title: string | null = null
  try {
    title = await suggestSessionTitle(fiche)
  } catch (err) {
    console.warn('[generate-session-audio] titre', err instanceof Error ? err.message : err)
  }
  const { error } = await admin
    .from('sessions')
    .update({
      script: generated.script,
      ...(title ? { title } : {}),
      audio_job: null,
      audio_bytes: 12,
      status: 'generating',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
  if (error) console.warn('[generate-session-audio] save script', error.message)
  await noteUsage(admin, sessionId, {
    promptVersion: PROMPT_VERSION,
    scriptWords: spokenWords(generated.script),
    llmPromptTokens: generated.usage?.prompt ?? null,
    llmCompletionTokens: generated.usage?.completion ?? null,
  })
  return generated.script
}

function resolveElevenVoiceId(appVoiceId: string | null): string {
  const key = (appVoiceId ?? 'rituel').toLowerCase()
  const envMap: Record<string, string | undefined> = {
    rituel: Deno.env.get('ELEVENLABS_VOICE_RITUEL'),
    onde: Deno.env.get('ELEVENLABS_VOICE_ONDE'),
    rachel: Deno.env.get('ELEVENLABS_VOICE_RACHEL'),
    antoni: Deno.env.get('ELEVENLABS_VOICE_ANTONI'),
    bella: Deno.env.get('ELEVENLABS_VOICE_BELLA'),
    louis: Deno.env.get('ELEVENLABS_VOICE_LOUIS'),
    aurore: Deno.env.get('ELEVENLABS_VOICE_AURORE'),
    maelis: Deno.env.get('ELEVENLABS_VOICE_MAELIS'),
  }
  return envMap[key] || DEFAULT_VOICES[key] || DEFAULT_VOICES.rituel
}

/** Page HTML ou coupure réseau : le segment suivant peut reprendre. */
function isTransientGateway(message: string): boolean {
  return /not valid JSON|<!DOCTYPE|Unexpected token|Failed to fetch|ECONNRESET|gateway|timed out|timeout|502|503|504/i.test(message)
}

async function setProgress(
  admin: SupabaseClient,
  sessionId: string,
  pct: number,
  job: AudioJob,
  matchClaimId?: string | null,
): Promise<boolean> {
  const value = Math.round(Math.min(99, Math.max(1, pct)))
  const owned = matchClaimId === undefined ? job.claimId : matchClaimId
  if (job.claimId) job.claimedAt = new Date().toISOString()
  let query = admin
    .from('sessions')
    .update({
      audio_bytes: value,
      audio_job: job,
      status: 'generating',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
    .neq('status', 'ready')
  if (owned) query = query.eq('audio_job->>claimId', owned)
  const { data, error } = await query.select('id')
  if (error) {
    console.warn('[generate-session-audio] progress', error.message)
    return false
  }
  return Boolean(data?.length)
}

/** Pose le plan, ou prend le droit d’écrire la voix. Un seul appelant gagne. */
async function claimSession(
  admin: SupabaseClient,
  sessionId: string,
  job: AudioJob,
  bytes: number,
  mode: 'install' | 'claim' | 'replace',
): Promise<boolean> {
  const { data, error } = await admin.rpc('claim_session_audio', {
    p_session: sessionId,
    p_job: job,
    p_bytes: bytes,
    p_mode: mode,
  })
  if (error) {
    console.error('[generate-session-audio] claim', error.message)
    return false
  }
  return data === true
}

function elevenVoiceSettings(appVoiceKey: string) {
  const key = appVoiceKey.toLowerCase()
  return {
    /** Plus haut = moins de sautes de ton/rythme entre blocs ; un peu moins d’expressivité. */
    stability: key === 'rituel' || key === 'louis' ? 0.88 : 0.82,
    /** Colle à la voix du début. Le débit reste 1. */
    similarity_boost: 0.75,
    style: 0,
    use_speaker_boost: false,
    speed: 1.0,
  }
}

/** L’ouverture reste dans les 3 identifiants permis, avec les deux derniers blocs. */
function stitchIds(job: AudioJob): string[] {
  const anchor = job.anchorRequestIds?.find((id) => id)
  const recent = job.previousRequestIds.filter((id) => id && id !== anchor)
  const tail = recent.slice(-2)
  return anchor ? [anchor, ...tail].slice(0, 3) : tail.slice(-3)
}

function sessionSeed(job: AudioJob): number {
  if (typeof job.seed === 'number' && job.seed >= 0) return job.seed
  job.seed = Math.floor(Math.random() * 4294967295)
  return job.seed
}

/**
 * « sens » et « sent » partent souvent en anglais (/sɛns/, /sɛnt/).
 * « sans » est le même son /sɑ̃/, et la voix le dit juste.
 * Le script affiché garde « sens » / « sent ».
 */
function frenchForSpeech(text: string): string {
  const sans = (word: string) => (word[0] === word[0]?.toUpperCase() ? 'Sans' : 'sans')
  return text.replace(/\bsens\b/gi, sans).replace(/\bsent\b/gi, sans)
}

function elevenTtsBody(
  text: string,
  appVoiceKey: string,
  previousRequestIds: string[],
  seed: number,
) {
  return {
    text: frenchForSpeech(text),
    model_id: elevenModelId(),
    language_code: 'fr',
    seed,
    ...(previousRequestIds.length ? { previous_request_ids: previousRequestIds.slice(-3) } : {}),
    voice_settings: elevenVoiceSettings(appVoiceKey),
  }
}

async function elevenTts(params: {
  apiKey: string
  voiceId: string
  appVoiceKey: string
  text: string
  previousRequestIds: string[]
  seed: number
}): Promise<{ audio: Uint8Array; requestId: string | null }> {
  const ttsRes = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${params.voiceId}?output_format=${TTS_PCM_FORMAT}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': params.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/octet-stream',
      },
      body: JSON.stringify(
        elevenTtsBody(params.text, params.appVoiceKey, params.previousRequestIds, params.seed),
      ),
      signal: AbortSignal.timeout(35_000),
    },
  )

  if (!ttsRes.ok) {
    const detail = await ttsRes.text()
    if (ttsRes.status === 429 || ttsRes.status >= 500) {
      await new Promise((r) => setTimeout(r, 1500))
      const retry = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${params.voiceId}?output_format=${TTS_PCM_FORMAT}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': params.apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/octet-stream',
          },
          body: JSON.stringify(
            elevenTtsBody(params.text, params.appVoiceKey, params.previousRequestIds, params.seed),
          ),
          signal: AbortSignal.timeout(35_000),
        },
      )
      if (retry.ok) {
        const audio = new Uint8Array(await retry.arrayBuffer())
        return { audio, requestId: retry.headers.get('request-id') }
      }
    }
    throw new Error(`ElevenLabs ${ttsRes.status}: ${detail.slice(0, 240)}`)
  }

  const audio = new Uint8Array(await ttsRes.arrayBuffer())
  const requestId = ttsRes.headers.get('request-id')
  return { audio, requestId }
}

function jobIsBusy(job: AudioJob): boolean {
  if (!job.claimedAt || !job.claimId) return false
  const age = Date.now() - new Date(job.claimedAt).getTime()
  return age >= 0 && age < CLAIM_TTL_MS
}

function storageErrorText(error: unknown): string {
  if (!error || typeof error !== 'object') return error ? String(error) : 'missing'
  const row = error as { message?: string; statusCode?: string | number; status?: string | number; error?: string; name?: string }
  const text = [row.name, row.statusCode ?? row.status, row.error, row.message]
    .filter((part) => part != null && String(part).trim() !== '')
    .join(' ')
  return text || 'réponse storage vide'
}

/** Relit un segment. Deux assemblages en parallèle font renvoyer une erreur vide. */
async function downloadPart(
  admin: SupabaseClient,
  path: string,
  index: number,
): Promise<Uint8Array> {
  let last = 'missing'
  for (let attempt = 1; attempt <= 4; attempt++) {
    const { data, error } = await admin.storage.from('audios').download(path)
    if (!error && data) {
      const bytes = new Uint8Array(await data.arrayBuffer())
      if (bytes.byteLength >= 32) return bytes
      last = 'segment trop court'
    } else {
      last = storageErrorText(error)
    }
    if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 350 * attempt))
  }
  throw new Error(`Lecture part ${index}: ${last}`)
}

async function holdFinalizeClaim(admin: SupabaseClient, sessionId: string, job: AudioJob) {
  if (!job.claimId) job.claimId = crypto.randomUUID()
  job.claimedAt = new Date().toISOString()
  job.phase = 'finalize'
  const kept = await setProgress(admin, sessionId, progressPct(job), job)
  if (!kept) throw new Error('claim perdu')
}

async function releaseFinalizeClaim(admin: SupabaseClient, sessionId: string, job: AudioJob) {
  const owned = job.claimId
  job.claimId = null
  job.claimedAt = null
  job.phase = 'finalize'
  const kept = await setProgress(admin, sessionId, progressPct(job), job, owned)
  if (!kept) throw new Error('claim perdu')
}

function mixPartPath(userId: string, sessionId: string, index: number): string {
  return `${userId}/${sessionId}/mix/${String(index).padStart(4, '0')}.mp3`
}

async function clearFolder(admin: SupabaseClient, folder: string) {
  const { data } = await admin.storage.from('audios').list(folder, { limit: 1000 })
  if (!data?.length) return
  await admin.storage.from('audios').remove(data.map((f) => `${folder}/${f.name}`))
}

async function clearParts(admin: SupabaseClient, userId: string, sessionId: string) {
  await clearFolder(admin, `${userId}/${sessionId}/parts`)
  await clearFolder(admin, `${userId}/${sessionId}/mix`)
}

/** Évite de re-facturer ElevenLabs si le segment est déjà en Storage. */
async function partExists(
  admin: SupabaseClient,
  userId: string,
  sessionId: string,
  index: number,
  version: number,
) {
  const name = partPath(userId, sessionId, index, version).split('/').pop()!
  const { data } = await admin.storage.from('audios').list(`${userId}/${sessionId}/parts`, {
    limit: 1000,
    search: name,
  })
  return Boolean(data?.some((f) => f.name === name))
}

async function uploadPart(
  admin: SupabaseClient,
  path: string,
  bytes: Uint8Array,
  contentType: string,
) {
  const { error } = await admin.storage.from('audios').upload(path, bytes, {
    contentType,
    upsert: true,
  })
  if (error) throw new Error(`Storage part: ${error.message}`)
}

/** v8 garde le PCM en WAV. L’encodage MP3 unique a lieu au montage final. */
async function storeRenderedPart(
  admin: SupabaseClient,
  path: string,
  pcm: Int16Array,
  version: number,
) {
  if (version >= 8) {
    const wav = pcmToWav(pcm)
    if (wav.byteLength < 46) throw new Error('Segment audio trop court')
    await uploadPart(admin, path, wav, 'audio/wav')
    return
  }
  const mp3 = await encodeMp3(pcm)
  if (mp3.byteLength < 32) throw new Error('Segment audio trop court')
  await uploadPart(admin, path, mp3, 'audio/mpeg')
}

async function renderSilencePcm(params: {
  seconds: number
  voiceId: string | null
  bedOffset: number
  fadeOut?: boolean
  admin: SupabaseClient
}): Promise<{ pcm: Int16Array; bedOffset: number }> {
  const appVoiceKey = (params.voiceId ?? 'rituel').toLowerCase()
  const bed = await loadBed(appVoiceKey, params.admin)
  let pcm = upsampleTts(silencePcm(params.seconds))
  let nextOffset = params.bedOffset
  if (bed) {
    const mixed = mixLoopingBed(pcm, bed.pcm, bed.gain, params.bedOffset, bed.voiceScale)
    pcm = mixed.pcm
    nextOffset = mixed.nextOffset
  }
  if (params.fadeOut && pcm.length > 1) {
    const last = pcm.length - 1
    for (let i = 0; i < pcm.length; i++) pcm[i] = Math.round(pcm[i]! * (1 - i / last))
  }
  return { pcm, bedOffset: nextOffset }
}

async function processOneStep(params: {
  admin: SupabaseClient
  elevenKey: string
  sessionId: string
  userId: string
  voiceId: string | null
  script: string
  job: AudioJob
}): Promise<{ job: AudioJob; done: boolean }> {
  let job = params.job
  /** Sans ça, un appel lent (voix) dépasse 90 s, un autre passage reprend la phrase à zéro. */
  const beat = setInterval(() => {
    if (!job.claimId) return
    void setProgress(params.admin, params.sessionId, progressPct(job), job)
  }, 12_000)

  try {
    return await runAudioStep({ ...params, job })
  } finally {
    clearInterval(beat)
  }
}

async function runAudioStep(params: {
  admin: SupabaseClient
  elevenKey: string
  sessionId: string
  userId: string
  voiceId: string | null
  script: string
  job: AudioJob
}): Promise<{ job: AudioJob; done: boolean }> {
  const job = params.job

  if (job.phase === 'done') return { job, done: true }

  if (job.phase === 'finalize' || job.nextIndex >= job.steps.length) {
    const next = await finalizeJob(params)
    return { job: next, done: next.phase === 'done' }
  }

  while (job.nextIndex < job.steps.length) {
    const index = job.nextIndex
    const step = job.steps[index]
    if (!step) break
    const path = partPath(params.userId, params.sessionId, index, job.version)
    if (step.partPath || (await partExists(params.admin, params.userId, params.sessionId, index, job.version))) {
      if (step.kind === 'speech') {
        job.steps[index] = { kind: 'speech', partPath: path, requestId: step.requestId }
      } else {
        job.steps[index] = {
          kind: 'silence',
          seconds: step.seconds,
          ...(step.fadeOut ? { fadeOut: true } : {}),
          partPath: path,
        }
      }
      job.nextIndex = index + 1
      continue
    }
    break
  }

  if (job.nextIndex >= job.steps.length) {
    job.phase = 'finalize'
    await holdFinalizeClaim(params.admin, params.sessionId, job)
    const next = await finalizeJob({ ...params, job })
    return { job: next, done: next.phase === 'done' }
  }

  const priorIds: string[] = []
  for (let i = 0; i < job.nextIndex; i++) {
    const step = job.steps[i]
    if (step?.kind === 'speech' && step.requestId) priorIds.push(step.requestId)
  }
  if (priorIds.length) {
    job.anchorRequestIds = [priorIds[0]!]
    job.previousRequestIds = priorIds.slice(-3)
  }

  const window: { index: number; step: JobStep }[] = []
  let speechCount = 0
  for (let i = job.nextIndex; i < job.steps.length; i++) {
    const step = job.steps[i]
    if (!step) break
    if (step.kind === 'speech') {
      if (speechCount >= PARALLEL_SPEECH) break
      speechCount += 1
    }
    window.push({ index: i, step })
  }

  for (const item of window) {
    const { index, step } = item
    const path = partPath(params.userId, params.sessionId, index, job.version)

    if (step.kind === 'speech') {
      const text = speechTextAt(
        params.script,
        index,
        params.job.version >= 7 ? (params.job.durationMinutes ?? 15) : 0,
        params.job.version,
      )
      const tts = await elevenTts({
        apiKey: params.elevenKey,
        voiceId: resolveElevenVoiceId(params.voiceId),
        appVoiceKey: (params.voiceId ?? 'rituel').toLowerCase(),
        text,
        previousRequestIds: stitchIds(job),
        seed: sessionSeed(job),
      })
      const got = {
        pcm: upsampleTts(pcmFromEleven(tts.audio)),
        requestId: tts.requestId,
      }
      let pcm = levelSpeech(got.pcm)
      let nextOffset = job.bedOffset
      const bed = await loadBed((params.voiceId ?? 'rituel').toLowerCase(), params.admin)
      if (bed) {
        const mixed = mixLoopingBed(pcm, bed.pcm, bed.gain, job.bedOffset, bed.voiceScale)
        pcm = mixed.pcm
        nextOffset = mixed.nextOffset
      }
      await storeRenderedPart(params.admin, path, pcm, job.version)
      const previousRequestIds = [...job.previousRequestIds]
      if (got.requestId) {
        if (!job.anchorRequestIds?.length) job.anchorRequestIds = [got.requestId]
        previousRequestIds.push(got.requestId)
      }
      job.steps[index] = {
        kind: 'speech',
        partPath: path,
        ...(got.requestId ? { requestId: got.requestId } : {}),
      }
      job.bedOffset = nextOffset
      job.previousRequestIds = previousRequestIds.slice(-3)
      job.ttsChars = (job.ttsChars ?? 0) + text.length
    } else {
      const rendered = await renderSilencePcm({
        seconds: step.seconds,
        voiceId: params.voiceId,
        bedOffset: job.bedOffset,
        fadeOut: step.fadeOut,
        admin: params.admin,
      })
      await storeRenderedPart(params.admin, path, rendered.pcm, job.version)
      job.steps[index] = {
        kind: 'silence',
        seconds: step.seconds,
        ...(step.fadeOut ? { fadeOut: true } : {}),
        partPath: path,
      }
      job.bedOffset = rendered.bedOffset
    }

    job.nextIndex = index + 1
    job.stepAttempts = 0
    job.doneSpeech = job.steps.filter((s) => s.kind === 'speech' && s.partPath).length
    /** Garde le claim pendant les phrases enchaînées — sinon n8n / le filet relancent trop tôt. */
    const kept = await setProgress(params.admin, params.sessionId, progressPct(job), job)
    if (!kept) throw new Error('claim perdu')
  }

  if (job.nextIndex >= job.steps.length) job.phase = 'finalize'

  job.doneSpeech = job.steps.filter((s) => s.kind === 'speech' && s.partPath).length

  if (job.phase === 'finalize') {
    await holdFinalizeClaim(params.admin, params.sessionId, job)
    const next = await finalizeJob({ ...params, job })
    return { job: next, done: next.phase === 'done' }
  }

  const owned = job.claimId
  job.claimId = null
  job.claimedAt = null
  await setProgress(params.admin, params.sessionId, progressPct(job), job, owned)
  return { job, done: false }
}

async function concatStoredMp3s(
  admin: SupabaseClient,
  sessionId: string,
  userId: string,
  job: AudioJob,
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []
  for (let i = 0; i < job.steps.length; i++) {
    if (i > 0 && i % 8 === 0) await holdFinalizeClaim(admin, sessionId, job)
    const step = job.steps[i]!
    const path = step.partPath ?? partPath(userId, sessionId, i, job.version)
    chunks.push(await downloadPart(admin, path, i))
  }
  return concatBytes(chunks)
}

function mixHasMore(job: AudioJob): boolean {
  return (job.mixCursor ?? 0) < job.steps.length || (job.mixSample ?? 0) > 0
}

function encodeMixCarry(pcm: Int16Array): string | undefined {
  if (!pcm.length) return undefined
  const bytes = new Uint8Array(pcm.byteLength)
  bytes.set(new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength))
  let text = ''
  for (let i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i]!)
  return btoa(text)
}

function decodeMixCarry(encoded?: string): Int16Array {
  if (!encoded) return new Int16Array(0)
  const bin = atob(encoded)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const even = bytes.byteLength & ~1
  const copy = new Uint8Array(even)
  copy.set(bytes.subarray(0, even))
  return new Int16Array(copy.buffer)
}

function concatPcm(chunks: Int16Array[]): Int16Array {
  let n = 0
  for (const chunk of chunks) n += chunk.length
  const out = new Int16Array(n)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

/**
 * Si la tranche doit couper une phrase, recule jusqu’à un souffle dans
 * la dernière demi-seconde. Le joint reste, mais il tombe dans le silence.
 */
function seamCut(pcm: Int16Array, take: number): number {
  const win = Math.round(0.02 * MIX_RATE)
  if (take < win * 4 || take > pcm.length) return Math.min(take, pcm.length)
  const search = Math.min(take - win, Math.round(0.5 * MIX_RATE))
  const start = take - search
  const power = (at: number) => {
    let acc = 0
    const end = Math.min(pcm.length, at + win)
    for (let i = at; i < end; i++) acc += pcm[i]! * pcm[i]!
    return acc / win
  }
  const edge = power(Math.max(0, take - win))
  let bestAt = take
  let best = edge
  const step = Math.round(0.005 * MIX_RATE)
  for (let i = start; i + win <= take; i += step) {
    const v = power(i)
    if (v < best) {
      best = v
      bestAt = i
    }
  }
  if (bestAt < win || best > edge * 0.16) return take
  return bestAt
}

/**
 * Encode une tranche courte. Le fichier entier dépasse le plafond CPU
 * de l’Edge Function et la requête était tuée, barre figée à 94.
 */
async function writeMixSlice(
  admin: SupabaseClient,
  sessionId: string,
  userId: string,
  job: AudioJob,
) {
  const startCursor = job.mixCursor ?? 0
  const startSample = job.mixSample ?? 0
  let cursor = startCursor
  let offset = startSample
  let samples = 0
  const pieces: Int16Array[] = []

  while (cursor < job.steps.length && samples < MIX_SLICE_CAP) {
    if (pieces.length > 0 && pieces.length % 4 === 0) {
      await holdFinalizeClaim(admin, sessionId, job)
    }
    const step = job.steps[cursor]!
    const path = step.partPath ?? partPath(userId, sessionId, cursor, job.version)
    let pcm = pcmFromWav(await downloadPart(admin, path, cursor))
    if (offset > 0) {
      if (offset >= pcm.length) {
        cursor += 1
        offset = 0
        continue
      }
      pcm = pcm.subarray(offset)
    }
    const room = MIX_SLICE_CAP - samples
    if (pcm.length > room) {
      if (samples >= MIX_SLICE_SOFT) break
      const take = seamCut(pcm, Math.max(1, Math.min(pcm.length, room)))
      pieces.push(pcm.slice(0, take))
      offset += take
      samples += take
      break
    }
    pieces.push(Int16Array.from(pcm))
    samples += pcm.length
    cursor += 1
    offset = 0
    if (samples >= MIX_SLICE_SOFT && job.steps[cursor - 1]?.kind === 'silence') break
  }

  if (!pieces.length) {
    job.mixCursor = cursor
    job.mixSample = offset
    return
  }

  const atEnd = cursor >= job.steps.length && offset === 0
  const stream = await createMp3Stream()
  const carry = decodeMixCarry(job.mixCarry)
  const merged = concatPcm(carry.length ? [carry, ...pieces] : pieces)
  const opening = (job.mixPart ?? 0) === 0 && carry.length === 0
  if (!opening) fadeSeam(merged, 'in')
  if (!atEnd) fadeSeam(merged, 'out')
  stream.write(merged)
  if (!atEnd) stream.padSilence()
  const mp3 = stream.finish(atEnd)
  job.mixCarry = atEnd ? undefined : encodeMixCarry(stream.pending().slice())
  if (mp3.byteLength >= 32) {
    const partIndex = job.mixPart ?? 0
    await uploadPart(admin, mixPartPath(userId, sessionId, partIndex), mp3, 'audio/mpeg')
    job.mixPart = partIndex + 1
  } else if (atEnd) {
    throw new Error('Tranche MP3 trop courte')
  }
  job.mixCursor = cursor
  job.mixSample = offset
}

async function concatMixParts(
  admin: SupabaseClient,
  sessionId: string,
  userId: string,
  job: AudioJob,
): Promise<Uint8Array> {
  const folder = `${userId}/${sessionId}/mix`
  const { data, error } = await admin.storage.from('audios').list(folder, { limit: 1000 })
  if (error) throw new Error(`Liste montage: ${error.message}`)
  const names = (data ?? [])
    .map((file) => file.name)
    .filter((name) => /^\d+\.mp3$/.test(name))
    .sort()
  if (!names.length) throw new Error('Montage sans segments')
  const chunks: Uint8Array[] = []
  for (let i = 0; i < names.length; i++) {
    if (i % 8 === 0) await holdFinalizeClaim(admin, sessionId, job)
    chunks.push(await downloadPart(admin, `${folder}/${names[i]}`, i))
  }
  return concatBytes(chunks)
}

async function finalizeJob(params: {
  admin: SupabaseClient
  sessionId: string
  userId: string
  voiceId: string | null
  job: AudioJob
}): Promise<AudioJob> {
  const job = params.job
  const { data: existing } = await params.admin
    .from('sessions')
    .select('status, audio_path')
    .eq('id', params.sessionId)
    .maybeSingle()
  if (existing?.status === 'ready' && existing.audio_path) {
    job.phase = 'done'
    job.claimId = null
    job.claimedAt = null
    return job
  }

  await holdFinalizeClaim(params.admin, params.sessionId, job)

  let mp3: Uint8Array
  if (job.version >= 8) {
    if (mixHasMore(job)) {
      await writeMixSlice(params.admin, params.sessionId, params.userId, job)
      await holdFinalizeClaim(params.admin, params.sessionId, job)
    }
    if (mixHasMore(job)) {
      await releaseFinalizeClaim(params.admin, params.sessionId, job)
      return job
    }
    mp3 = await concatMixParts(params.admin, params.sessionId, params.userId, job)
  } else {
    mp3 = await concatStoredMp3s(params.admin, params.sessionId, params.userId, job)
  }

  const audioBytes = withAiDisclosureTag(mp3)
  if (audioBytes.byteLength < 1000) throw new Error('Fichier audio trop court')

  const path = `${params.userId}/${params.sessionId}.mp3`
  const { error: uploadError } = await params.admin.storage.from('audios').upload(path, audioBytes, {
    contentType: 'audio/mpeg',
    upsert: true,
  })
  if (uploadError) throw new Error(`Storage upload: ${uploadError.message}`)

  const { data: signed, error: signedError } = await params.admin.storage
    .from('audios')
    .createSignedUrl(path, 60 * 60 * 24 * 7)
  if (signedError || !signed?.signedUrl) {
    throw new Error(`Signed URL: ${signedError?.message ?? 'missing'}`)
  }

  job.phase = 'done'
  job.claimId = null
  job.claimedAt = null
  job.finishedAt = new Date().toISOString()
  delete job.error

  const { error: updateError } = await params.admin
    .from('sessions')
    .update({
      status: 'ready',
      audio_path: path,
      audio_url: signed.signedUrl,
      audio_bytes: audioBytes.byteLength,
      audio_job: job,
      voice_id: params.voiceId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.sessionId)

  if (updateError) throw new Error(`DB update: ${updateError.message}`)

  await noteUsage(params.admin, params.sessionId, {
    finishedAt: job.finishedAt,
    ttsChars: job.ttsChars ?? 0,
    promptVersion: job.promptVersion ?? PROMPT_VERSION,
    scriptWords: job.scriptWords ?? null,
    error: null,
  })

  /** Nettoyage best-effort des segments. */
  try {
    await clearParts(params.admin, params.userId, params.sessionId)
  } catch (err) {
    console.warn('[generate-session-audio] clear parts', err)
  }

  return job
}

function scheduleContinue(params: {
  supabaseUrl: string
  anonKey: string
  authHeader: string
  sessionId: string
  orchestratorSecret?: string
}) {
  const url = `${params.supabaseUrl}/functions/v1/generate-session-audio`
  const headers: Record<string, string> = {
    Authorization: params.authHeader,
    apikey: params.anonKey,
    'Content-Type': 'application/json',
  }
  if (params.orchestratorSecret) {
    headers['x-visiora-orchestrator-secret'] = params.orchestratorSecret
  }
  const run = fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ sessionId: params.sessionId, chain: true }),
  }).then(async (res) => {
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.warn('[generate-session-audio] chain', res.status, text.slice(0, 200))
    }
  }).catch((err) => console.warn('[generate-session-audio] chain failed', err))

  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(run)
  }
}

async function notifyN8n(sessionId: string): Promise<boolean> {
  const url = Deno.env.get('N8N_WEBHOOK_URL')?.trim()
  if (!url) return false
  const secret = Deno.env.get('VISIORA_ORCHESTRATOR_SECRET') ?? ''
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId,
        secret,
        source: 'visiora',
      }),
      signal: AbortSignal.timeout(8_000),
    })
    if (!res.ok) {
      console.warn('[generate-session-audio] n8n webhook', res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (err) {
    console.warn('[generate-session-audio] n8n webhook failed', err)
    return false
  }
}

function sessionMinutes(answers: unknown): number {
  const raw = answers && typeof answers === 'object'
    ? Number((answers as { duration_minutes?: unknown }).duration_minutes)
    : NaN
  if (raw === 3 || raw === 10 || raw === 15) return raw
  return 15
}

/**
 * n8n perd parfois sessionId après la pause (le lien .item casse).
 * Si une seule séance est encore en cours, l'orchestrateur peut la reprendre.
 */
async function findSoloGeneratingSession(admin: SupabaseClient): Promise<string | null> {
  const since = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const { data, error } = await admin
    .from('sessions')
    .select('id, updated_at')
    .eq('status', 'generating')
    .gte('updated_at', since)
    .order('updated_at', { ascending: false })
    .limit(2)
  if (error || !data?.length) return null
  const newest = data[0] as { id?: unknown; updated_at?: unknown }
  const id = typeof newest.id === 'string' ? newest.id : ''
  if (!id) return null
  if (data.length === 1) return id
  const second = data[1] as { updated_at?: unknown }
  const newestAt = new Date(String(newest.updated_at ?? '')).getTime()
  const secondAt = new Date(String(second.updated_at ?? '')).getTime()
  if (Number.isFinite(newestAt) && Number.isFinite(secondAt) && newestAt - secondAt > 60_000) {
    return id
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const elevenKey = Deno.env.get('ELEVENLABS_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const orchSecret = Deno.env.get('VISIORA_ORCHESTRATOR_SECRET') ?? ''
  const n8nConfigured = Boolean(Deno.env.get('N8N_WEBHOOK_URL')?.trim())

  if (!elevenKey || !supabaseUrl || !serviceKey || !anonKey) {
    return json({ error: 'Server misconfigured (secrets manquants)' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const headerSecret = req.headers.get('x-visiora-orchestrator-secret') ?? ''
  const isOrchestrator = Boolean(orchSecret && headerSecret && headerSecret === orchSecret)

  let sessionId = ''
  let force = false
  let reset = false
  let chain = false
  try {
    const body = (await req.json()) as {
      sessionId?: string
      force?: boolean | string
      reset?: boolean | string
      chain?: boolean | string
      compare?: boolean | string
      model?: string
    }
    const fromBody = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
    const fromQuery = new URL(req.url).searchParams.get('sessionId')?.trim() ?? ''
    sessionId = fromBody || fromQuery
    force = body.force === true || body.force === 'true'
    reset = body.reset === true || body.reset === 'true'
    chain = body.chain === true || body.chain === 'true'

    if (body.compare === true || body.compare === 'true') {
      if (!sessionId) return json({ error: 'sessionId required' }, 400)
      const model = body.model?.trim()
      if (!model) return json({ error: 'model required' }, 400)
      const adminCompare = createClient(supabaseUrl, serviceKey)
      const { data: compareSession, error: compareErr } = await adminCompare
        .from('sessions')
        .select('id, user_id, answers')
        .eq('id', sessionId)
        .maybeSingle()
      if (compareErr || !compareSession) return json({ error: 'Session introuvable' }, 404)
      if (!isOrchestrator) {
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        })
        const {
          data: { user },
          error: userError,
        } = await userClient.auth.getUser()
        if (userError || !user) return json({ error: 'Unauthorized' }, 401)
        if (compareSession.user_id !== user.id) return json({ error: 'Forbidden' }, 403)
      }
      try {
        const generated = await generateSessionScriptDetailed(
          compareSession.answers && typeof compareSession.answers === 'object'
            ? (compareSession.answers as Record<string, unknown>)
            : {},
          model,
        )
        return json({
          ok: true,
          model: generated.model,
          script: generated.script,
          usage: generated.usage,
        })
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'compare failed'
        return json({ ok: false, error: detail }, 500)
      }
    }
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceKey)
  if (!sessionId) {
    if (!(isOrchestrator && chain)) return json({ error: 'sessionId required' }, 400)
    const found = await findSoloGeneratingSession(admin)
    if (!found) return json({ error: 'sessionId required' }, 400)
    console.warn('[generate-session-audio] sessionId repris, séance en cours', found)
    sessionId = found
  }
  const { data: session, error: sessionError } = await admin
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle()

  if (sessionError || !session) {
    return json({ error: 'Session introuvable' }, 404)
  }

  let callerUserId: string | null = null
  if (isOrchestrator) {
    callerUserId = session.user_id as string
  } else {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()
    if (userError || !user) {
      return json({ error: 'Unauthorized' }, 401)
    }
    if (session.user_id !== user.id) {
      return json({ error: 'Forbidden' }, 403)
    }
    callerUserId = user.id
  }

  if (session.status === 'ready' && session.audio_path && !force && !reset) {
    return json({ ok: true, accepted: true, status: 'ready' }, 202)
  }

  /** N8N s’arrête sur failed. Le bouton Relancer, lui, reprend : le script s’il n’a pas été écrit, sinon les segments déjà prêts. */
  if (session.status === 'failed' && !force && !reset && isOrchestrator) {
    return json({
      ok: false,
      error: 'Generation failed',
      status: 'failed',
    }, 200)
  }

  const canBackground = typeof EdgeRuntime !== 'undefined' && Boolean(EdgeRuntime?.waitUntil)

  /** Script d'abord, hors du TTS : un seul appel au modèle, pas de timeout client. */
  if (!hasStoredScript(session.script) && canGenerateScript()) {
    if (isScriptInProgress(session.audio_job)) {
      return json({ ok: true, accepted: true, status: 'generating', progress: 8 }, 202)
    }

    await admin
      .from('sessions')
      .update({
        status: 'generating',
        audio_bytes: 8,
        audio_job: scriptClaimPayload(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
    await noteUsage(admin, sessionId, {
      startedAt: new Date().toISOString(),
      finishedAt: null,
      error: null,
      ttsChars: null,
    })

    const runScript = async () => {
      try {
        await saveGeneratedScript(admin, sessionId, session.answers)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'script failed'
        console.error('[generate-session-audio] script failed', message)
        await noteUsage(admin, sessionId, {
          promptVersion: PROMPT_VERSION,
          finishedAt: new Date().toISOString(),
          error: message.slice(0, 180),
        })
        await admin
          .from('sessions')
          .update({
            status: 'failed',
            audio_job: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId)
        return
      }
      if (n8nConfigured) {
        const handed = await notifyN8n(sessionId)
        if (handed) {
          await admin
            .from('sessions')
            .update({
              audio_job: n8nQueuePayload(),
              audio_bytes: 17,
              status: 'generating',
              updated_at: new Date().toISOString(),
            })
            .eq('id', sessionId)
          return
        }
        console.warn('[generate-session-audio] n8n injoignable, la séance continue ici')
      }
      scheduleContinue({
        supabaseUrl,
        anonKey,
        authHeader,
        sessionId,
      })
    }

    if (canBackground) {
      EdgeRuntime!.waitUntil(runScript())
      return json({
        ok: true,
        accepted: true,
        status: 'generating',
        progress: 8,
        orchestrated: n8nConfigured || isOrchestrator,
      }, 202)
    }

    await runScript()
    return json({
      ok: true,
      accepted: true,
      status: 'generating',
      progress: 8,
      orchestrated: n8nConfigured,
    }, 202)
  }

  const queuedAge = n8nQueueAgeMs(session.audio_job)
  if (queuedAge != null && queuedAge < 25_000 && !isOrchestrator && !chain) {
    return json({
      ok: true,
      accepted: true,
      status: 'generating',
      progress: 17,
      orchestrated: true,
    }, 202)
  }

  let job = isAudioJob(session.audio_job) ? (session.audio_job as AudioJob) : null

  if (reset || (force && !job)) {
    await clearParts(admin, callerUserId!, sessionId)
    job = null
  }

  if (job && jobIsBusy(job) && !reset) {
    return json({
      ok: true,
      accepted: true,
      status: 'generating',
      progress: progressPct(job),
    }, 202)
  }

  const script = resolveScript(session)
  if (!script.trim()) {
    await noteUsage(admin, sessionId, {
      finishedAt: new Date().toISOString(),
      error: 'Script manquant',
    })
    await admin
      .from('sessions')
      .update({
        status: 'failed',
        audio_job: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
    return json({ ok: false, error: 'Script manquant', status: 'failed' }, 409)
  }
  const voiceId = (session.voice_id as string | null) ?? null
  const voiceKey = (voiceId ?? 'rituel').toLowerCase()

  if (!job) {
    job = createAudioJob(script, voiceKey, sessionMinutes(session.answers))
    if (isOrchestrator || n8nConfigured) job.handedToN8n = true
    const installed = await claimSession(admin, sessionId, job, 5, reset ? 'replace' : 'install')
    if (!installed) {
      return json({
        ok: true,
        accepted: true,
        status: 'generating',
        progress: 5,
      }, 202)
    }
  }

  /**
   * Démarrage user (pas chain / pas orchestrateur) + N8N configuré
   * → on confie la boucle longue à N8N (meilleure fiabilité 15 min).
   */
  if (!isOrchestrator && !chain && n8nConfigured && job.phase !== 'finalize') {
    if (session.status === 'failed') job.handedToN8n = false
    const updatedAt = new Date(String(session.updated_at ?? '')).getTime()
    const quietMs = Number.isFinite(updatedAt) ? Date.now() - updatedAt : 0
    const n8nQuiet = Boolean(job.handedToN8n) && quietMs >= 25_000
    if (job.handedToN8n && !n8nQuiet) {
      return json({
        ok: true,
        accepted: true,
        status: 'generating',
        progress: progressPct(job),
        orchestrated: true,
      }, 202)
    }
    if (!n8nQuiet) {
      job.handedToN8n = true
      await admin
        .from('sessions')
        .update({
          audio_job: job,
          audio_bytes: progressPct(job),
          status: 'generating',
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId)
        .neq('status', 'ready')
      const handed = await notifyN8n(sessionId)
      if (handed) {
        return json({
          ok: true,
          accepted: true,
          status: 'generating',
          progress: progressPct(job),
          orchestrated: true,
        }, 202)
      }
      job.handedToN8n = false
    }
  }

  if (job.claimedAt) {
    const age = Date.now() - new Date(job.claimedAt).getTime()
    if (age >= CLAIM_TTL_MS) {
      if (job.attemptIndex !== job.nextIndex) {
        job.attemptIndex = job.nextIndex
        job.stepAttempts = 1
      } else {
        job.stepAttempts = (job.stepAttempts ?? 0) + 1
      }
      if ((job.stepAttempts ?? 0) >= 4) {
        const error = 'La génération s’est interrompue plusieurs fois au même endroit.'
        job.claimId = null
        job.claimedAt = null
        job.error = error
        job.finishedAt = new Date().toISOString()
        await admin
          .from('sessions')
          .update({
            status: 'failed',
            audio_job: job,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId)
          .neq('status', 'ready')
        await noteUsage(admin, sessionId, {
          finishedAt: job.finishedAt,
          error,
        })
        return json({ ok: false, error, status: 'failed' }, isOrchestrator ? 200 : 500)
      }
    }
  }

  job.claimId = crypto.randomUUID()
  job.claimedAt = new Date().toISOString()
  const claimed = await claimSession(admin, sessionId, job, progressPct(job), 'claim')
  if (!claimed) {
    return json({
      ok: true,
      accepted: true,
      status: 'generating',
      progress: progressPct(job),
    }, 202)
  }

  const runWork = async () => {
    try {
      const result = await processOneStep({
        admin,
        elevenKey,
        sessionId,
        userId: callerUserId!,
        voiceId,
        script,
        job,
      })
      if (!result.done) {
        scheduleContinue({
          supabaseUrl,
          anonKey,
          authHeader,
          sessionId,
          orchestratorSecret: orchSecret || undefined,
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed'
      if (message === 'claim perdu') {
        console.warn('[generate-session-audio] claim déjà pris')
        return
      }
      console.error('[generate-session-audio]', message)
      await noteUsage(admin, sessionId, { error: message.slice(0, 180) })
      const owned = job?.claimId ?? null
      if (job) {
        job.claimId = null
        job.claimedAt = null
      }
      const { data: current } = await admin
        .from('sessions')
        .select('status, audio_path')
        .eq('id', sessionId)
        .maybeSingle()
      if (current?.status === 'ready' || current?.audio_path) {
        return
      }
      const nextStatus = isTransientGateway(message) ? 'generating' : 'failed'
      if (isTransientGateway(message)) {
        console.warn('[generate-session-audio] reprise après coupure', message.slice(0, 160))
      }
      if (nextStatus === 'failed' && job) {
        job.finishedAt = new Date().toISOString()
        job.error = message.slice(0, 180)
      }
      if (owned && job) {
        await admin
          .from('sessions')
          .update({
            status: nextStatus,
            audio_job: job,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId)
          .eq('audio_job->>claimId', owned)
          .neq('status', 'ready')
      } else if (nextStatus === 'failed') {
        await admin
          .from('sessions')
          .update({
            status: 'failed',
            audio_job: job,
            updated_at: new Date().toISOString(),
          })
          .eq('id', sessionId)
          .neq('status', 'ready')
      }
      if (nextStatus === 'failed') {
        await noteUsage(admin, sessionId, {
          finishedAt: job?.finishedAt ?? new Date().toISOString(),
          error: message.slice(0, 180),
          ttsChars: job?.ttsChars ?? null,
          promptVersion: job?.promptVersion ?? null,
          scriptWords: job?.scriptWords ?? null,
        })
      }
      if (nextStatus === 'generating') {
        scheduleContinue({
          supabaseUrl,
          anonKey,
          authHeader,
          sessionId,
          orchestratorSecret: orchSecret || undefined,
        })
        return
      }
      throw err
    }
  }

  /**
   * Réponse 202 immédiate + travail en arrière-plan.
   * Évite que le client (timeout invoke) marque « Réessayer » alors que le job tourne.
   */
  if (canBackground) {
    EdgeRuntime!.waitUntil(runWork())
    return json({
      ok: true,
      accepted: true,
      status: 'generating',
      progress: progressPct(job),
      orchestrated: job.phase === 'finalize' ? false : n8nConfigured || isOrchestrator,
    }, 202)
  }

  /** Orchestrateur / fallback sync : on attend la fin du step (ou drain démo). */
  try {
    await runWork()
    const { data: fresh } = await admin
      .from('sessions')
      .select('status, audio_bytes, audio_job')
      .eq('id', sessionId)
      .maybeSingle()
    if (fresh?.status === 'ready') {
      return json({ ok: true, accepted: true, status: 'ready' }, 200)
    }
    if (fresh?.status === 'failed') {
      return json({
        ok: false,
        error: 'Generation failed',
        status: 'failed',
      }, isOrchestrator ? 200 : 500)
    }
    const freshJob = isAudioJob(fresh?.audio_job) ? (fresh!.audio_job as AudioJob) : job
    return json({
      ok: true,
      accepted: true,
      status: 'generating',
      progress: progressPct(freshJob),
      continue: true,
      orchestrated: freshJob.phase === 'finalize' ? false : n8nConfigured || isOrchestrator,
    }, 202)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed'
    console.error('[generate-session-audio]', message)
    return json({ ok: false, error: message, status: 'failed' }, 500)
  }
})
