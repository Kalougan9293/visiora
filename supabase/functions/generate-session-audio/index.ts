import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { chunkSpeech, parseAnnexScript, resolveScript } from './script.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEFAULT_VOICES: Record<string, string> = {
  /** Secrets ELEVENLABS_VOICE_* prioritaires */
  /** 1 · Vanessa — clone oiseaux + musique */
  rituel: '1zaEYJSYmxoQNiDl5C42',
  /** 2 · Sabrina — clone fond eau */
  onde: 'JQ2r7F93aKZaFxO6C5Tu',
  /** 3 · Amandine */
  antoni: 'nVPCtAFzgyMX3FZKNzH0',
  /** Anciens slots (séances déjà créées) */
  rachel: 'zPy2sgLU4pZ7Xrjh87uz',
  bella: 'EXAVITQu4vr4xnSDxMaL',
}

const STALE_MS = 8 * 60 * 1000

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

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.byteLength, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.byteLength
  }
  return out
}

function repeatBytes(unit: Uint8Array, times: number): Uint8Array {
  const count = Math.max(1, Math.round(times))
  return concatBytes(Array.from({ length: count }, () => unit))
}

function generatedSilence1s(): Uint8Array {
  const samplesPerFrame = 1152
  const sampleRate = 44100
  const frameSize = 417
  const frames = Math.max(1, Math.round(sampleRate / samplesPerFrame))
  const frame = new Uint8Array(frameSize)
  frame[0] = 0xff
  frame[1] = 0xfb
  frame[2] = 0x90
  frame[3] = 0x04
  return concatBytes(Array.from({ length: frames }, () => frame))
}

async function loadSilence1s(): Promise<Uint8Array> {
  try {
    return await Deno.readFile(new URL('./silence-1s.mp3', import.meta.url))
  } catch {
    return generatedSilence1s()
  }
}

async function setProgress(admin: SupabaseClient, sessionId: string, pct: number) {
  const value = Math.round(Math.min(99, Math.max(1, pct)))
  const { error } = await admin
    .from('sessions')
    .update({ audio_bytes: value, updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('status', 'generating')
  if (error) console.warn('[generate-session-audio] progress', error.message)
}

async function elevenTts(params: {
  apiKey: string
  voiceId: string
  /** Clé app (rituel / onde / antoni) pour caler le rythme */
  appVoiceKey: string
  text: string
  previousRequestIds: string[]
}): Promise<{ audio: Uint8Array; requestId: string | null }> {
  const key = params.appVoiceKey.toLowerCase()
  /** Vanessa : rythme lent ; Sabrina / Amandine : tempo naturel */
  const speed = key === 'rituel' ? 0.78 : key === 'onde' ? 1.0 : 0.95
  const ttsRes = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${params.voiceId}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': params.apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: params.text,
        model_id: 'eleven_multilingual_v2',
        language_code: 'fr',
        ...(params.previousRequestIds.length
          ? { previous_request_ids: params.previousRequestIds.slice(-3) }
          : {}),
        voice_settings: {
          stability: key === 'rituel' ? 0.88 : 0.72,
          similarity_boost: 0.55,
          style: 0,
          use_speaker_boost: false,
          speed,
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

async function processJob(params: {
  admin: SupabaseClient
  elevenKey: string
  sessionId: string
  userId: string
  voiceId: string | null
  script: string
}) {
  const parts = parseAnnexScript(params.script)
  if (!parts.some((p) => p.kind === 'speech')) {
    throw new Error('Script sans texte parlé')
  }

  const speechChunks = parts.flatMap((part) => (part.kind === 'speech' ? chunkSpeech(part.text) : []))
  const totalSpeech = Math.max(1, speechChunks.length)
  let doneSpeech = 0

  await setProgress(params.admin, params.sessionId, 8)

  const silence1s = await loadSilence1s()
  const mp3Parts: Uint8Array[] = []
  const previousRequestIds: string[] = []

  for (const part of parts) {
    if (part.kind === 'silence') {
      mp3Parts.push(repeatBytes(silence1s, part.seconds))
      continue
    }
    for (const chunk of chunkSpeech(part.text)) {
      const { audio, requestId } = await elevenTts({
        apiKey: params.elevenKey,
        voiceId: resolveElevenVoiceId(params.voiceId),
        appVoiceKey: (params.voiceId ?? 'rituel').toLowerCase(),
        text: chunk,
        previousRequestIds,
      })
      mp3Parts.push(audio)
      if (requestId) previousRequestIds.push(requestId)
      doneSpeech += 1
      await setProgress(params.admin, params.sessionId, 8 + (doneSpeech / totalSpeech) * 80)
    }
  }

  await setProgress(params.admin, params.sessionId, 92)

  const audioBytes = concatBytes(mp3Parts)
  if (audioBytes.byteLength < 1000) {
    throw new Error('Fichier audio trop court')
  }

  const path = `${params.userId}/${params.sessionId}.mp3`
  const { error: uploadError } = await params.admin.storage.from('audios').upload(path, audioBytes, {
    contentType: 'audio/mpeg',
    upsert: true,
  })
  if (uploadError) {
    throw new Error(`Storage upload: ${uploadError.message}`)
  }

  const { data: signed, error: signedError } = await params.admin.storage
    .from('audios')
    .createSignedUrl(path, 60 * 60 * 24 * 7)

  if (signedError || !signed?.signedUrl) {
    throw new Error(`Signed URL: ${signedError?.message ?? 'missing'}`)
  }

  const { error: updateError } = await params.admin
    .from('sessions')
    .update({
      status: 'ready',
      audio_path: path,
      audio_url: signed.signedUrl,
      audio_bytes: audioBytes.byteLength,
      voice_id: params.voiceId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.sessionId)

  if (updateError) {
    throw new Error(`DB update: ${updateError.message}`)
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

  if (!elevenKey || !supabaseUrl || !serviceKey || !anonKey) {
    return json({ error: 'Server misconfigured (secrets manquants)' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return json({ error: 'Unauthorized' }, 401)
  }

  let sessionId: string
  let force = false
  try {
    const body = (await req.json()) as { sessionId?: string; force?: boolean }
    if (!body.sessionId) return json({ error: 'sessionId required' }, 400)
    sessionId = body.sessionId
    force = Boolean(body.force)
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

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

  const admin = createClient(supabaseUrl, serviceKey)
  const { data: session, error: sessionError } = await admin
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle()

  if (sessionError || !session) {
    return json({ error: 'Session introuvable' }, 404)
  }
  if (session.user_id !== user.id) {
    return json({ error: 'Forbidden' }, 403)
  }

  const updatedAt = new Date(session.updated_at as string).getTime()
  const progress = Number(session.audio_bytes)
  const jobStarted = session.status === 'generating' && progress >= 8 && progress <= 100
  const stillRunning = jobStarted && Date.now() - updatedAt < STALE_MS && !force
  if (session.status === 'ready' && session.audio_path && !force) {
    return json({ ok: true, accepted: true, status: 'ready' }, 202)
  }
  if (stillRunning) {
    return json({ ok: true, accepted: true, status: 'generating' }, 202)
  }

  await admin
    .from('sessions')
    .update({ status: 'generating', audio_bytes: 5, updated_at: new Date().toISOString() })
    .eq('id', sessionId)

  const script = resolveScript(session)

  try {
    await processJob({
      admin,
      elevenKey,
      sessionId,
      userId: user.id,
      voiceId: (session.voice_id as string | null) ?? null,
      script,
    })
    return json({ ok: true, accepted: true, status: 'ready' }, 200)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed'
    console.error('[generate-session-audio]', message)
    await admin
      .from('sessions')
      .update({ status: 'failed', updated_at: new Date().toISOString() })
      .eq('id', sessionId)
    return json({ ok: false, error: message, status: 'failed' }, 500)
  }
})
