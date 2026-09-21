import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import {
  createAudioJob,
  isAudioJob,
  partPath,
  progressPct,
  concatBytes,
  speechTextAt,
  type AudioJob,
  type JobStep,
} from './job.ts'
import { isDemoShortMode, resolveScript, demoSessionParts } from './script.ts'
import {
  TTS_PCM_FORMAT,
  upsampleTts,
  encodeMp3,
  pcmFromEleven,
  silencePcm,
  loadBed,
  mixLoopingBed,
  concatPcm,
  silenceBedMp3,
} from './mix.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-visiora-orchestrator-secret',
}

const DEFAULT_VOICES: Record<string, string> = {
  rituel: '1zaEYJSYmxoQNiDl5C42',
  antoni: 'iYo3urNKUm5TVGCFojl0',
  onde: 'JQ2r7F93aKZaFxO6C5Tu',
  rachel: 'zPy2sgLU4pZ7Xrjh87uz',
  bella: 'EXAVITQu4vr4xnSDxMaL',
}

/** Autre invoke en cours : ne pas double-traiter le même step. */
const CLAIM_TTL_MS = 55_000

declare const EdgeRuntime: { waitUntil: (promise: Promise<unknown>) => void } | undefined

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function resolveElevenVoiceId(appVoiceId: string | null): string {
  const key = (appVoiceId ?? 'rituel').toLowerCase()
  const envMap: Record<string, string | undefined> = {
    rituel: Deno.env.get('ELEVENLABS_VOICE_RITUEL'),
    onde: Deno.env.get('ELEVENLABS_VOICE_ONDE'),
    rachel: Deno.env.get('ELEVENLABS_VOICE_RACHEL'),
    antoni: Deno.env.get('ELEVENLABS_VOICE_ANTONI'),
    bella: Deno.env.get('ELEVENLABS_VOICE_BELLA'),
  }
  return envMap[key] || DEFAULT_VOICES[key] || DEFAULT_VOICES.rituel
}

/**
 * Chemin démo (~15 s) : TTS par phrase + blancs + lit d’ambiance, un seul MP3.
 */
async function handleDemoShort(params: {
  admin: SupabaseClient
  elevenKey: string
  sessionId: string
  userId: string
  voiceId: string | null
}): Promise<Response> {
  const script = resolveScript({ script: null })
  const steps = demoSessionParts(script)
  const speechChars = steps
    .filter((s): s is { kind: 'speech'; text: string } => s.kind === 'speech')
    .reduce((n, s) => n + s.text.length, 0)
  if (speechChars < 20) {
    return json({ ok: false, error: 'Script démo vide', status: 'failed' }, 500)
  }

  const appVoiceKey = (params.voiceId ?? 'rituel').toLowerCase()
  await params.admin
    .from('sessions')
    .update({
      status: 'generating',
      script,
      audio_bytes: 15,
      audio_job: null,
      audio_path: null,
      audio_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.sessionId)

  const bed = await loadBed(appVoiceKey)
  const pcmParts: Int16Array[] = []
  const previousRequestIds: string[] = []
  let bedOffset = 0

  for (const step of steps) {
    let pcm: Int16Array
    if (step.kind === 'silence') {
      pcm = upsampleTts(silencePcm(step.seconds))
    } else {
      const tts = await elevenTts({
        apiKey: params.elevenKey,
        voiceId: resolveElevenVoiceId(params.voiceId),
        appVoiceKey,
        text: step.text,
        previousRequestIds,
      })
      pcm = upsampleTts(pcmFromEleven(tts.audio))
      if (tts.requestId) previousRequestIds.push(tts.requestId)
    }
    if (bed) {
      const mixed = mixLoopingBed(pcm, bed.pcm, bed.gain, bedOffset)
      pcm = mixed.pcm
      bedOffset = mixed.nextOffset
    }
    pcmParts.push(pcm)
  }

  const mp3 = await encodeMp3(concatPcm(pcmParts))
  if (mp3.byteLength < 32) throw new Error('Segment audio trop court')

  const path = `${params.userId}/${params.sessionId}.mp3`
  const { error: uploadError } = await params.admin.storage.from('audios').upload(path, mp3, {
    contentType: 'audio/mpeg',
    upsert: true,
  })
  if (uploadError) {
    await params.admin
      .from('sessions')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', params.sessionId)
    return json({ ok: false, error: `Storage: ${uploadError.message}`, status: 'failed' }, 500)
  }

  const { data: signed, error: signedError } = await params.admin.storage
    .from('audios')
    .createSignedUrl(path, 60 * 60 * 24 * 7)
  if (signedError || !signed?.signedUrl) {
    await params.admin
      .from('sessions')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', params.sessionId)
    return json({
      ok: false,
      error: `Signed URL: ${signedError?.message ?? 'missing'}`,
      status: 'failed',
    }, 500)
  }

  const { error: updateError } = await params.admin
    .from('sessions')
    .update({
      status: 'ready',
      script,
      audio_path: path,
      audio_url: signed.signedUrl,
      audio_bytes: mp3.byteLength,
      audio_job: null,
      voice_id: params.voiceId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.sessionId)

  if (updateError) {
    return json({ ok: false, error: `DB: ${updateError.message}`, status: 'failed' }, 500)
  }

  return json({ ok: true, accepted: true, status: 'ready' }, 200)
}

async function setProgress(admin: SupabaseClient, sessionId: string, pct: number, job: AudioJob) {
  const value = Math.round(Math.min(99, Math.max(1, pct)))
  const { error } = await admin
    .from('sessions')
    .update({
      audio_bytes: value,
      audio_job: job,
      status: 'generating',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sessionId)
  if (error) console.warn('[generate-session-audio] progress', error.message)
}

async function elevenTts(params: {
  apiKey: string
  voiceId: string
  appVoiceKey: string
  text: string
  previousRequestIds: string[]
}): Promise<{ audio: Uint8Array; requestId: string | null }> {
  const key = params.appVoiceKey.toLowerCase()
  const ttsRes = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${params.voiceId}?output_format=${TTS_PCM_FORMAT}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': params.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/octet-stream',
      },
      body: JSON.stringify({
        text: params.text,
        model_id: 'eleven_multilingual_v2',
        language_code: 'fr',
        ...(params.previousRequestIds.length
          ? { previous_request_ids: params.previousRequestIds.slice(-3) }
          : {}),
        voice_settings: {
          stability: key === 'rituel' ? 0.8 : 0.72,
          similarity_boost: 0.55,
          style: 0,
          use_speaker_boost: false,
          speed: 1.0,
        },
      }),
    },
  )

  if (!ttsRes.ok) {
    const detail = await ttsRes.text()
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

async function clearParts(admin: SupabaseClient, userId: string, sessionId: string) {
  const prefix = `${userId}/${sessionId}/parts`
  const { data } = await admin.storage.from('audios').list(`${userId}/${sessionId}/parts`, { limit: 1000 })
  if (!data?.length) return
  const paths = data.map((f) => `${prefix}/${f.name}`)
  await admin.storage.from('audios').remove(paths)
}

/** Évite de re-facturer ElevenLabs si le segment est déjà en Storage. */
async function partExists(admin: SupabaseClient, userId: string, sessionId: string, index: number) {
  const name = `${String(index).padStart(4, '0')}.mp3`
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
) {
  const { error } = await admin.storage.from('audios').upload(path, bytes, {
    contentType: 'audio/mpeg',
    upsert: true,
  })
  if (error) throw new Error(`Storage part: ${error.message}`)
}

async function encodeStepMp3(params: {
  step: JobStep
  speechText?: string
  elevenKey: string
  voiceId: string | null
  previousRequestIds: string[]
  bedOffset: number
}): Promise<{
  mp3: Uint8Array
  requestId: string | null
  bedOffset: number
  previousRequestIds: string[]
}> {
  const appVoiceKey = (params.voiceId ?? 'rituel').toLowerCase()
  let requestId: string | null = null
  const previousRequestIds = [...params.previousRequestIds]
  const sampleRate = 44100

  if (params.step.kind === 'silence') {
    const pre = await silenceBedMp3(appVoiceKey, params.step.seconds)
    const bedForOffset = await loadBed(appVoiceKey)
    const loopLen = Math.max(1, bedForOffset?.pcm.length ?? sampleRate * 12)
    const nextOffset =
      (params.bedOffset + Math.round(params.step.seconds * sampleRate)) % loopLen
    if (pre && pre.byteLength >= 32) {
      return { mp3: pre, requestId: null, bedOffset: nextOffset, previousRequestIds }
    }
    const bed = await loadBed(appVoiceKey)
    let pcm = upsampleTts(silencePcm(params.step.seconds))
    if (bed) {
      const mixed = mixLoopingBed(pcm, bed.pcm, bed.gain, params.bedOffset)
      pcm = mixed.pcm
      const mp3 = await encodeMp3(pcm)
      if (mp3.byteLength < 32) throw new Error('Segment audio trop court')
      return { mp3, requestId: null, bedOffset: mixed.nextOffset, previousRequestIds }
    }
    const mp3 = await encodeMp3(pcm)
    if (mp3.byteLength < 32) throw new Error('Segment audio trop court')
    return { mp3, requestId: null, bedOffset: nextOffset, previousRequestIds }
  }

  const text = params.speechText?.trim()
  if (!text) throw new Error('Segment speech sans texte')
  const tts = await elevenTts({
    apiKey: params.elevenKey,
    voiceId: resolveElevenVoiceId(params.voiceId),
    appVoiceKey,
    text,
    previousRequestIds,
  })
  const pcm24 = pcmFromEleven(tts.audio)
  requestId = tts.requestId
  if (requestId) previousRequestIds.push(requestId)

  let pcm = upsampleTts(pcm24)
  let nextOffset = params.bedOffset
  const bed = await loadBed(appVoiceKey)
  if (bed) {
    const mixed = mixLoopingBed(pcm, bed.pcm, bed.gain, params.bedOffset)
    pcm = mixed.pcm
    nextOffset = mixed.nextOffset
  }

  const mp3 = await encodeMp3(pcm)
  if (mp3.byteLength < 32) throw new Error('Segment audio trop court')
  return { mp3, requestId, bedOffset: nextOffset, previousRequestIds }
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

  if (job.phase === 'done') return { job, done: true }

  if (job.phase === 'finalize' || job.nextIndex >= job.steps.length) {
    return { job: await finalizeJob(params), done: true }
  }

  let didSpeech = false
  let silenceBudget = 20

  while (job.nextIndex < job.steps.length) {
    const index = job.nextIndex
    const step = job.steps[index]
    if (!step) break

    if (step.kind === 'speech' && didSpeech) break

    const path = partPath(params.userId, params.sessionId, index)

    if (step.partPath || (await partExists(params.admin, params.userId, params.sessionId, index))) {
      if (step.kind === 'speech') {
        job.steps[index] = { kind: 'speech', partPath: path, requestId: step.requestId }
      } else {
        job.steps[index] = { kind: 'silence', seconds: step.seconds, partPath: path }
      }
      job.nextIndex = index + 1
      continue
    }

    if (step.kind === 'silence') {
      if (silenceBudget <= 0) break
      silenceBudget -= 1
    } else {
      didSpeech = true
    }

    const encoded = await encodeStepMp3({
      step,
      speechText: step.kind === 'speech' ? speechTextAt(params.script, index) : undefined,
      elevenKey: params.elevenKey,
      voiceId: params.voiceId,
      previousRequestIds: job.previousRequestIds,
      bedOffset: job.bedOffset,
    })

    await uploadPart(params.admin, path, encoded.mp3)

    if (step.kind === 'speech') {
      job.steps[index] = {
        kind: 'speech',
        partPath: path,
        ...(encoded.requestId ? { requestId: encoded.requestId } : {}),
      }
    } else {
      job.steps[index] = { kind: 'silence', seconds: step.seconds, partPath: path }
    }
    job.bedOffset = encoded.bedOffset
    job.previousRequestIds = encoded.previousRequestIds
    job.nextIndex = index + 1

    job.doneSpeech = job.steps.filter((s) => s.kind === 'speech' && s.partPath).length
    const snapshot = { ...job, claimId: null, claimedAt: null }
    await setProgress(params.admin, params.sessionId, progressPct(snapshot), snapshot)
    job.claimId = null
    job.claimedAt = null
  }

  if (job.nextIndex >= job.steps.length) job.phase = 'finalize'

  job.doneSpeech = job.steps.filter((s) => s.kind === 'speech' && s.partPath).length
  job.claimId = null
  job.claimedAt = null
  await setProgress(params.admin, params.sessionId, progressPct(job), job)

  if (job.phase === 'finalize') {
    return { job: await finalizeJob({ ...params, job }), done: true }
  }
  return { job, done: false }
}

async function finalizeJob(params: {
  admin: SupabaseClient
  sessionId: string
  userId: string
  voiceId: string | null
  job: AudioJob
}): Promise<AudioJob> {
  const job = params.job
  job.phase = 'finalize'
  await setProgress(params.admin, params.sessionId, 94, job)

  const chunks: Uint8Array[] = []
  for (let i = 0; i < job.steps.length; i++) {
    const step = job.steps[i]!
    const path = step.partPath ?? partPath(params.userId, params.sessionId, i)
    const { data, error } = await params.admin.storage.from('audios').download(path)
    if (error || !data) throw new Error(`Lecture part ${i}: ${error?.message ?? 'missing'}`)
    chunks.push(new Uint8Array(await data.arrayBuffer()))
  }

  const audioBytes = concatBytes(chunks)
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

  let sessionId: string
  let force = false
  let reset = false
  let chain = false
  try {
    const body = (await req.json()) as {
      sessionId?: string
      force?: boolean
      reset?: boolean
      chain?: boolean
    }
    if (!body.sessionId) return json({ error: 'sessionId required' }, 400)
    sessionId = body.sessionId
    force = Boolean(body.force)
    reset = Boolean(body.reset)
    chain = Boolean(body.chain)
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const admin = createClient(supabaseUrl, serviceKey)
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

  /** Mode démo client : chemin simple sync (TTS + lit d’ambiance, pas de chunks / N8N). */
  if (isDemoShortMode()) {
    try {
      return await handleDemoShort({
        admin,
        elevenKey,
        sessionId,
        userId: callerUserId!,
        voiceId: (session.voice_id as string | null) ?? null,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed'
      console.error('[generate-session-audio] demo', message)
      await admin
        .from('sessions')
        .update({ status: 'failed', updated_at: new Date().toISOString() })
        .eq('id', sessionId)
      return json({ ok: false, error: message, status: 'failed' }, 500)
    }
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
  const voiceId = (session.voice_id as string | null) ?? null
  const voiceKey = (voiceId ?? 'rituel').toLowerCase()

  if (!job) {
    job = createAudioJob(script, voiceKey)
    const { error: initError } = await admin
      .from('sessions')
      .update({
        status: 'generating',
        script,
        audio_bytes: 5,
        audio_job: job,
        audio_path: null,
        audio_url: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
    if (initError) {
      console.error('[generate-session-audio] init job', initError.message)
      return json({ ok: false, error: `Init job: ${initError.message}`, status: 'failed' }, 500)
    }
  }

  /**
   * Démarrage user (pas chain / pas orchestrateur) + N8N configuré
   * → on confie la boucle longue à N8N (meilleure fiabilité 15 min).
   */
  if (!isOrchestrator && !chain && n8nConfigured) {
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
    /** Fallback si N8N down : on traite quand même un step ici. */
  }

  const claimId = crypto.randomUUID()
  job.claimId = claimId
  job.claimedAt = new Date().toISOString()
  await setProgress(admin, sessionId, progressPct(job), job)

  const runWork = async () => {
    try {
      const demoDrain = isDemoShortMode()
      let result = await processOneStep({
        admin,
        elevenKey,
        sessionId,
        userId: callerUserId!,
        voiceId,
        script,
        job,
      })
      while (demoDrain && !result.done) {
        result = await processOneStep({
          admin,
          elevenKey,
          sessionId,
          userId: callerUserId!,
          voiceId,
          script,
          job: result.job,
        })
      }
      if (!result.done && !isOrchestrator) {
        scheduleContinue({
          supabaseUrl,
          anonKey,
          authHeader,
          sessionId,
        })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Generation failed'
      console.error('[generate-session-audio]', message)
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
  }

  /**
   * Réponse 202 immédiate + travail en arrière-plan.
   * Évite que le client (timeout invoke) marque « Réessayer » alors que le job tourne.
   */
  const canBackground = typeof EdgeRuntime !== 'undefined' && Boolean(EdgeRuntime?.waitUntil)
  if (canBackground && !isOrchestrator) {
    EdgeRuntime!.waitUntil(runWork())
    return json({
      ok: true,
      accepted: true,
      status: 'generating',
      progress: progressPct(job),
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
      return json({ ok: false, error: 'Generation failed', status: 'failed' }, 500)
    }
    const freshJob = isAudioJob(fresh?.audio_job) ? (fresh!.audio_job as AudioJob) : job
    return json({
      ok: true,
      accepted: true,
      status: 'generating',
      progress: progressPct(freshJob),
      continue: true,
      orchestrated: n8nConfigured || isOrchestrator,
    }, 202)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed'
    console.error('[generate-session-audio]', message)
    return json({ ok: false, error: message, status: 'failed' }, 500)
  }
})
