import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import {
  TTS_PCM_FORMAT,
  encodeMp3,
  levelSpeech,
  loadBed,
  mixLoopingBed,
  pcmFromEleven,
  upsampleTts,
} from '../generate-session-audio/mix.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FIXED_SLOTS = new Set(['aurore', 'steve'])
const SLOT = /^(?:aurore|steve|v\d{10,16})$/
const CURRENT_BED = 'antoni'
const CUSTOM_BED = /^custom\/(?:bed|aurore|steve|v\d{10,16})-\d{10,16}\.wav$/

const PREVIEW_TEXT =
  'Installe-toi confortablement. ... Les yeux peuvent se fermer. ... Sens le contact du sol, le poids du corps. ... A chaque inspiration, tu es un peu plus present.'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function frenchForSpeech(text: string): string {
  const sans = (word: string) => (word[0] === word[0]?.toUpperCase() ? 'Sans' : 'sans')
  return text.replace(/\bsens\b/gi, sans).replace(/\bsent\b/gi, sans)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const elevenKey = Deno.env.get('ELEVENLABS_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!elevenKey || !supabaseUrl || !anonKey || !serviceKey) {
    return json({ error: 'Server misconfigured' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Unauthorized' }, 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: isAdmin, error: adminErr } = await userClient.rpc('is_current_user_admin')
  if (adminErr || !isAdmin) return json({ error: 'Compte non admin' }, 403)

  let body: { slot?: string; label?: string; elevenVoiceId?: string; bed?: string; bedLabel?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Requête illisible' }, 400)
  }

  const slot = (body.slot ?? '').trim().toLowerCase()
  const label = (body.label ?? '').trim()
  const elevenVoiceId = (body.elevenVoiceId ?? '').trim()
  const bed = (body.bed ?? '').trim()
  const bedLabel = (body.bedLabel ?? '').trim() || 'Sleep Music'
  if (!SLOT.test(slot)) return json({ error: 'Voix inconnue' }, 400)
  if (!label || label.length > 16) return json({ error: 'Le nom doit faire 1 à 16 caractères' }, 400)
  if (!/^[A-Za-z0-9]{10,40}$/.test(elevenVoiceId)) return json({ error: 'Identifiant ElevenLabs invalide' }, 400)
  if (FIXED_SLOTS.has(slot)) {
    if (bed !== CURRENT_BED && !CUSTOM_BED.test(bed)) return json({ error: 'Fond inconnu' }, 400)
  } else if (!CUSTOM_BED.test(bed)) {
    return json({ error: 'Ajoute un fichier de fond' }, 400)
  }
  if (bedLabel.length > 48) return json({ error: 'Le nom du fond est trop long' }, 400)

  const admin = createClient(supabaseUrl, serviceKey)
  try {
    const spoken = await fetchSpeech(elevenKey, elevenVoiceId)
    const leveled = levelSpeech(upsampleTts(pcmFromEleven(spoken)))
    const dry = await encodeMp3(leveled)
    const bedPcm = await loadBed(slot, admin, bed)
    if (!bedPcm) return json({ error: 'Fond introuvable' }, 502)
    const mixed = await encodeMp3(mixLoopingBed(leveled, bedPcm.pcm, bedPcm.gain, 0, bedPcm.voiceScale).pcm)
    const stamp = Date.now()
    const dryPath = `${slot}-dry.mp3`
    const previewPath = `${slot}-preview.mp3`
    await uploadPreview(admin, dryPath, dry)
    await uploadPreview(admin, previewPath, mixed)
    const dryUrl = `${supabaseUrl}/storage/v1/object/public/voice-previews/${dryPath}?v=${stamp}`
    const previewUrl = `${supabaseUrl}/storage/v1/object/public/voice-previews/${previewPath}?v=${stamp}`
    const { data, error } = await admin
      .from('voice_slots')
      .upsert({
        slot,
        label,
        eleven_voice_id: elevenVoiceId,
        bed,
        bed_label: bedLabel,
        preview_url: previewUrl,
        dry_url: dryUrl,
        updated_at: new Date().toISOString(),
      })
      .select('slot, label, eleven_voice_id, bed, bed_label, preview_url, dry_url')
      .single()
    if (error) return json({ error: error.message }, 500)
    await dropUnusedBeds(admin)
    return json({ ok: true, slot: data })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Extrait impossible'
    return json({ error: message }, 502)
  }
})

async function dropUnusedBeds(admin: ReturnType<typeof createClient>) {
  const { data: slots } = await admin.from('voice_slots').select('bed')
  const used = new Set((slots ?? []).map((row) => String((row as { bed?: string }).bed ?? '')))
  const { data: files } = await admin.storage.from('beds').list('custom')
  const drop = (files ?? [])
    .map((file) => `custom/${file.name}`)
    .filter((path) => /^custom\/(?:bed|aurore|steve|v\d{10,16})-\d{10,16}\.wav$/.test(path) && !used.has(path))
  if (drop.length) await admin.storage.from('beds').remove(drop)
}

async function fetchSpeech(apiKey: string, voiceId: string): Promise<Uint8Array> {
  const model = Deno.env.get('VISIORA_ELEVEN_MODEL')?.trim() || 'eleven_multilingual_v2'
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${TTS_PCM_FORMAT}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/octet-stream',
      },
      body: JSON.stringify({
        text: frenchForSpeech(PREVIEW_TEXT),
        model_id: model,
        language_code: 'fr',
        seed: 42,
        voice_settings: {
          stability: 0.82,
          similarity_boost: 0.75,
          style: 0,
          use_speaker_boost: false,
          speed: 1,
        },
      }),
      signal: AbortSignal.timeout(40_000),
    },
  )
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`ElevenLabs ${res.status}: ${detail.slice(0, 180)}`)
  }
  return new Uint8Array(await res.arrayBuffer())
}

async function uploadPreview(
  admin: ReturnType<typeof createClient>,
  path: string,
  bytes: Uint8Array,
) {
  const { error } = await admin.storage.from('voice-previews').upload(path, new Blob([bytes], { type: 'audio/mpeg' }), {
    contentType: 'audio/mpeg',
    upsert: true,
  })
  if (error) throw new Error(error.message)
}
