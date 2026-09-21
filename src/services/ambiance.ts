/**
 * Fonds sonores sous la voix (eau / oiseaux / spa).
 * Liés à la voix choisie — pas de choix séparé dans le wizard.
 * Démarrés dans le même geste utilisateur que Play (Safari iPhone).
 * Certaines voix (ex. Damien) n’ont pas encore de fond → null.
 */

import { VOICES } from '@/data/wizard'

export type AmbianceId = 'eau' | 'oiseaux' | 'spa'
export type AmbianceChoice = AmbianceId | null

const VOICE_AMBIANCE: Record<string, AmbianceChoice> = Object.fromEntries(
  VOICES.map((v) => [v.id, v.ambiance]),
) as Record<string, AmbianceChoice>

const LOOP_SRC: Record<AmbianceId, string> = {
  eau: '/voices/ambiance-eau.mp3',
  oiseaux: '/voices/ambiance-oiseaux.mp3?v=bed3',
  spa: '/voices/ambiance-spa.mp3',
}

const VOLUME: Record<AmbianceId, number> = {
  eau: 0.08,
  oiseaux: 0.06,
  spa: 0.05,
}

let ctx: AudioContext | null = null
let master: GainNode | null = null
let source: AudioBufferSourceNode | null = null
let holders = 0
let started = false
let activeId: AmbianceId = 'eau'
const bufferCache = new Map<AmbianceId, AudioBuffer>()

function ensureContext(): AudioContext {
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new Ctor()
  }
  return ctx
}

async function loadBuffer(ac: AudioContext, id: AmbianceId): Promise<AudioBuffer> {
  const cached = bufferCache.get(id)
  if (cached) return cached
  const res = await fetch(LOOP_SRC[id])
  if (!res.ok) throw new Error(`ambiance ${id}: ${res.status}`)
  const buf = await ac.decodeAudioData(await res.arrayBuffer())
  bufferCache.set(id, buf)
  return buf
}

async function startGraph(ac: AudioContext, id: AmbianceId) {
  if (started && activeId === id) return
  stopGraph(false)

  const out = ac.createGain()
  out.gain.value = VOLUME[id]
  out.connect(ac.destination)
  master = out

  const buf = await loadBuffer(ac, id)
  const src = ac.createBufferSource()
  src.buffer = buf
  src.loop = true
  src.connect(out)
  src.start()
  source = src
  activeId = id
  started = true
}

function stopGraph(suspendCtx: boolean) {
  if (source) {
    try {
      source.stop()
    } catch {
      /* already stopped */
    }
    source.disconnect()
    source = null
  }
  master?.disconnect()
  master = null
  started = false
  if (suspendCtx && ctx && ctx.state !== 'closed') void ctx.suspend()
}

/** À appeler dans le click Play, avant voice.play(). null = pas de fond. */
export function holdAmbiance(id: AmbianceChoice = 'eau') {
  if (!id) return
  holders += 1
  const ac = ensureContext()
  void ac.resume()
  void startGraph(ac, id).catch((err) => {
    console.warn('[ambiance] start failed', err)
  })
}

/** Pause / fin de séance / démontage. */
export function releaseAmbiance() {
  holders = Math.max(0, holders - 1)
  if (holders > 0) return
  stopGraph(true)
}

export function ambianceForVoice(voiceId: string | null | undefined): AmbianceChoice {
  if (!voiceId) return 'oiseaux'
  return VOICE_AMBIANCE[voiceId.toLowerCase()] ?? 'oiseaux'
}

export function ambianceFromAnswers(answers: Record<string, unknown> | undefined): AmbianceChoice {
  const voice = answers?.q12_voice
  if (typeof voice === 'string' && voice.trim()) {
    return ambianceForVoice(voice.trim())
  }
  /** Anciennes séances : fallback sur q12_ambiance si présent */
  const raw = answers?.q12_ambiance
  if (raw === 'eau' || raw === 'oiseaux' || raw === 'spa') return raw
  return 'oiseaux'
}
