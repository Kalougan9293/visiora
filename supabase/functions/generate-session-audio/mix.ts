/** Mixe un lit d’ambiance sous la voix PCM, puis encode MP3. */

import { LAME_SRC } from './assets.ts'
import {
  RITUEL_LOOP_WAV,
  ONDE_LOOP_WAV,
  ANTONI_LOOP_WAV,
} from './beds-data.ts'

const SAMPLE_RATE = 44100
const TTS_RATE = 24000

export const TTS_PCM_FORMAT = 'pcm_24000'

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

const BED_WAV_B64: Record<string, string> = {
  rituel: RITUEL_LOOP_WAV,
  onde: ONDE_LOOP_WAV,
  antoni: ANTONI_LOOP_WAV,
}

/**
 * Le lit est déjà normalisé à −42 dBFS dans smoothBed.
 * Gain 1 : le pic est calé dans smoothBed.
 * Assez présent pour tenir sous les pauses, assez bas pour rester sous la voix.
 */
const BED_GAIN: Record<string, number> = {
  rituel: 1,
  onde: 1,
  antoni: 1,
}

type LoadedBed = { key: string; pcm: Int16Array; gain: number }
let bedCache: LoadedBed | null = null

export async function loadBed(appVoiceKey: string): Promise<{ pcm: Int16Array; gain: number } | null> {
  const key = appVoiceKey.toLowerCase()
  const b64 = BED_WAV_B64[key]
  const gain = BED_GAIN[key]
  if (!b64 || gain == null) return null
  if (bedCache?.key === key) return bedCache
  try {
    const pcm = smoothBed(pcmFromWav(b64ToBytes(b64)))
    bedCache = { key, pcm, gain }
    return bedCache
  } catch (err) {
    console.warn('[mix] bed missing', key, err)
    return null
  }
}

function readU32(bytes: Uint8Array, i: number) {
  return bytes[i]! | (bytes[i + 1]! << 8) | (bytes[i + 2]! << 16) | (bytes[i + 3]! << 24)
}

function readU16(bytes: Uint8Array, i: number) {
  return bytes[i]! | (bytes[i + 1]! << 8)
}

/**
 * Le lit brut a un sifflement vers 3 kHz, fort quelques secondes par tour.
 * On ne garde que le grave, on égalise le tour, puis on cale le pic à −32 dBFS
 * pour que la pause reste un fond continu, sans couvrir la voix.
 */
const BED_PEAK_TARGET = Math.round(32768 * 10 ** (-32 / 20))

/** Le lit brut a un creux d’environ 1 s à chaque tour. On tient le niveau pour que la pause ne se recoupe pas. */
function flattenBedEnvelope(cur: Float64Array) {
  const win = Math.round(0.25 * SAMPLE_RATE)
  const env = new Float64Array(cur.length)
  let sum = 0
  for (let i = 0; i < cur.length; i++) {
    const s = cur[i]!
    sum += s * s
    if (i >= win) sum -= cur[i - win]! ** 2
    const n = i + 1 < win ? i + 1 : win
    env[i] = Math.sqrt(Math.max(0, sum) / n)
  }
  const probe: number[] = []
  for (let i = win; i < env.length; i += 400) probe.push(env[i]!)
  if (!probe.length) return
  probe.sort((a, b) => a - b)
  const target = probe[Math.floor(probe.length * 0.7)]!
  if (target < 1) return
  const maxGain = 10 ** (24 / 20)
  const follow = 1 - Math.exp(-1 / (0.12 * SAMPLE_RATE))
  let g = 1
  for (let i = 0; i < cur.length; i++) {
    const base = env[i]!
    const desired = base > target * 0.015 ? target / base : maxGain
    const clamped = Math.min(maxGain, Math.max(0.45, desired))
    g += follow * (clamped - g)
    cur[i] = cur[i]! * g
  }
}

function smoothBed(pcm: Int16Array): Int16Array {
  const cutoffHz = 900
  const poles = 4
  const a = 1 - Math.exp((-2 * Math.PI * cutoffHz) / SAMPLE_RATE)
  let cur = new Float64Array(pcm.length)
  for (let i = 0; i < pcm.length; i++) cur[i] = pcm[i]!
  for (let p = 0; p < poles; p++) {
    let acc = 0
    for (let i = 0; i < cur.length; i++) {
      acc += a * (cur[i]! - acc)
      cur[i] = acc
    }
  }
  flattenBedEnvelope(cur)
  let peak = 0
  for (let i = 0; i < cur.length; i++) {
    const v = Math.abs(cur[i]!)
    if (v > peak) peak = v
  }
  const g = peak > 1 ? BED_PEAK_TARGET / peak : 0
  const out = new Int16Array(pcm.length)
  for (let i = 0; i < cur.length; i++) {
    const s = cur[i]! * g
    out[i] = s > 32767 ? 32767 : s < -32768 ? -32768 : s
  }
  return out
}

/** PCM s16le mono 44.1 kHz depuis un WAV. */
export function pcmFromWav(bytes: Uint8Array): Int16Array {
  if (bytes.byteLength < 44) throw new Error('WAV trop court')
  let i = 12
  let channels = 1
  let rate = SAMPLE_RATE
  let bits = 16
  let data: Uint8Array | null = null
  while (i + 8 <= bytes.byteLength) {
    const id = String.fromCharCode(bytes[i]!, bytes[i + 1]!, bytes[i + 2]!, bytes[i + 3]!)
    const size = readU32(bytes, i + 4)
    const start = i + 8
    if (id === 'fmt ') {
      channels = readU16(bytes, start + 2)
      rate = readU32(bytes, start + 4)
      bits = readU16(bytes, start + 14)
    } else if (id === 'data') {
      data = bytes.subarray(start, start + size)
      break
    }
    i = start + size + (size % 2)
  }
  if (!data) throw new Error('WAV sans data')
  if (rate !== SAMPLE_RATE) throw new Error(`WAV ${rate} Hz (attendu ${SAMPLE_RATE})`)
  if (bits !== 16) throw new Error(`WAV ${bits} bit (attendu 16)`)
  const copy = new Uint8Array(data.byteLength)
  copy.set(data)
  const samples = new Int16Array(copy.buffer)
  if (channels === 1) return samples
  const mono = new Int16Array(Math.floor(samples.length / channels))
  for (let s = 0; s < mono.length; s++) {
    let acc = 0
    for (let c = 0; c < channels; c++) acc += samples[s * channels + c]!
    mono[s] = acc / channels
  }
  return mono
}

/** PCM s16le mono 44,1 kHz → WAV. Les segments v8 sont stockés ainsi, puis encodés une seule fois. */
export function pcmToWav(pcm: Int16Array): Uint8Array {
  const dataBytes = pcm.length * 2
  const out = new Uint8Array(44 + dataBytes)
  const view = new DataView(out.buffer)
  out.set([0x52, 0x49, 0x46, 0x46], 0)
  view.setUint32(4, 36 + dataBytes, true)
  out.set([0x57, 0x41, 0x56, 0x45], 8)
  out.set([0x66, 0x6d, 0x74, 0x20], 12)
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, SAMPLE_RATE, true)
  view.setUint32(28, SAMPLE_RATE * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  out.set([0x64, 0x61, 0x74, 0x61], 36)
  view.setUint32(40, dataBytes, true)
  const samples = new Uint8Array(pcm.buffer, pcm.byteOffset, pcm.byteLength)
  out.set(samples, 44)
  return out
}

export function pcmFromEleven(bytes: Uint8Array): Int16Array {
  if (bytes.byteLength >= 12 && String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!) === 'RIFF') {
    return pcmFromWav(bytes)
  }
  const even = bytes.byteLength & ~1
  const copy = new Uint8Array(even)
  copy.set(bytes.subarray(0, even))
  return new Int16Array(copy.buffer)
}

export function silencePcm(seconds: number): Int16Array {
  return new Int16Array(Math.max(1, Math.round(seconds * TTS_RATE)))
}

export function resamplePcm(pcm: Int16Array, fromRate: number, toRate: number): Int16Array {
  if (fromRate === toRate) return pcm
  const ratio = toRate / fromRate
  const outLen = Math.max(1, Math.round(pcm.length * ratio))
  const out = new Int16Array(outLen)
  const last = pcm.length - 1
  for (let i = 0; i < outLen; i++) {
    const src = i / ratio
    const i0 = Math.min(last, Math.floor(src))
    const i1 = Math.min(last, i0 + 1)
    const t = src - i0
    out[i] = pcm[i0]! * (1 - t) + pcm[i1]! * t
  }
  return out
}

export function upsampleTts(pcm: Int16Array): Int16Array {
  return resamplePcm(pcm, TTS_RATE, SAMPLE_RATE)
}

/** Cible avant le scale 0.88 du mix lit + voix → environ −19 LUFS à l’écoute. */
const SPEECH_LUFS_TARGET = -18
/** Un passage très faible n’est pas remonté de plus de 18 dB. Le creux vers 4:50 en demande autant. */
const SPEECH_BOOST_MAX_DB = 18
const SPEECH_PEAK_CEILING = 30000
const FADE_SECONDS = 0.015

type Biquad = { b0: number; b1: number; b2: number; a1: number; a2: number }

/** Pondération K (ITU-R BS.1770) à 44,1 kHz : pré-filtre + passe-haut. */
function kWeightingFilters(): { shelf: Biquad; highpass: Biquad } {
  return {
    shelf: highShelf(SAMPLE_RATE, 1681.974450955533, 0.7071752369554196, 3.999843853973347),
    highpass: highPass(SAMPLE_RATE, 38.13547087602444, 0.5003270373238773),
  }
}

const K_WEIGHT = kWeightingFilters()

function highShelf(fs: number, f0: number, q: number, gainDb: number): Biquad {
  const A = 10 ** (gainDb / 40)
  const w0 = (2 * Math.PI * f0) / fs
  const cos = Math.cos(w0)
  const alpha = Math.sin(w0) / (2 * q)
  const twoSqrt = 2 * Math.sqrt(A) * alpha
  const b0 = A * (A + 1 + (A - 1) * cos + twoSqrt)
  const b1 = -2 * A * (A - 1 + (A + 1) * cos)
  const b2 = A * (A + 1 + (A - 1) * cos - twoSqrt)
  const a0 = A + 1 - (A - 1) * cos + twoSqrt
  const a1 = 2 * (A - 1 - (A + 1) * cos)
  const a2 = A + 1 - (A - 1) * cos - twoSqrt
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 }
}

function highPass(fs: number, f0: number, q: number): Biquad {
  const w0 = (2 * Math.PI * f0) / fs
  const cos = Math.cos(w0)
  const alpha = Math.sin(w0) / (2 * q)
  const b0 = (1 + cos) / 2
  const b1 = -(1 + cos)
  const b2 = (1 + cos) / 2
  const a0 = 1 + alpha
  const a1 = -2 * cos
  const a2 = 1 - alpha
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 }
}

function applyBiquad(x: Float64Array, q: Biquad) {
  let x1 = 0
  let x2 = 0
  let y1 = 0
  let y2 = 0
  for (let i = 0; i < x.length; i++) {
    const x0 = x[i]!
    const y0 = q.b0 * x0 + q.b1 * x1 + q.b2 * x2 - q.a1 * y1 - q.a2 * y2
    x[i] = y0
    x2 = x1
    x1 = x0
    y2 = y1
    y1 = y0
  }
}

function energyToLufs(meanSquare: number): number {
  if (meanSquare <= 1e-12) return -100
  return -0.691 + 10 * Math.log10(meanSquare)
}

function meanSquare(samples: Float64Array, start: number, length: number): number {
  let sum = 0
  const end = start + length
  for (let i = start; i < end; i++) {
    const s = samples[i]!
    sum += s * s
  }
  return sum / length
}

/**
 * Sonie d’une phrase, en LUFS, pondération K et portes BS.1770.
 * Null si le passage est du silence.
 */
export function measureLufs(pcm: Int16Array): number | null {
  if (pcm.length < 80) return null
  const weighted = new Float64Array(pcm.length)
  for (let i = 0; i < pcm.length; i++) weighted[i] = pcm[i]! / 32768
  applyBiquad(weighted, K_WEIGHT.shelf)
  applyBiquad(weighted, K_WEIGHT.highpass)

  const block = Math.round(0.4 * SAMPLE_RATE)
  const hop = Math.round(0.1 * SAMPLE_RATE)
  const powers: number[] = []
  if (weighted.length < block) {
    powers.push(meanSquare(weighted, 0, weighted.length))
  } else {
    for (let start = 0; start + block <= weighted.length; start += hop) {
      powers.push(meanSquare(weighted, start, block))
    }
  }
  const audible = powers.filter((power) => energyToLufs(power) > -70)
  if (!audible.length) return null
  const ungated = energyToLufs(audible.reduce((sum, power) => sum + power, 0) / audible.length)
  const kept = audible.filter((power) => energyToLufs(power) >= ungated - 10)
  const used = kept.length ? kept : audible
  return energyToLufs(used.reduce((sum, power) => sum + power, 0) / used.length)
}

/**
 * Ramène chaque phrase vers −18 LUFS, avec un fondu de 15 ms.
 * Le fondu ne tient que si l’encodage MP3 est fait une seule fois, après le collage.
 */
export function levelSpeech(pcm: Int16Array): Int16Array {
  if (pcm.length < 80) return pcm
  const lufs = measureLufs(pcm)
  let gain = 1
  if (lufs != null) {
    let delta = SPEECH_LUFS_TARGET - lufs
    if (delta > SPEECH_BOOST_MAX_DB) delta = SPEECH_BOOST_MAX_DB
    gain = 10 ** (delta / 20)
  }
  let peak = 0
  let hot = 0
  for (let i = 0; i < pcm.length; i++) {
    const v = Math.abs(pcm[i]!) * gain
    if (v > peak) peak = v
    if (v > SPEECH_PEAK_CEILING) hot += 1
  }
  if (peak < 8) return pcm
  /** Un clic isolé ne doit pas garder toute la phrase trop basse. On ne baisse le gain que si le dépassement est large. */
  if (hot > pcm.length * 0.03 && peak > 0) gain *= SPEECH_PEAK_CEILING / peak
  const fade = Math.min(Math.round(FADE_SECONDS * SAMPLE_RATE), Math.floor(pcm.length / 10))
  for (let i = 0; i < pcm.length; i++) {
    let g = gain
    if (fade > 0 && i < fade) g *= i / fade
    else if (fade > 0 && i > pcm.length - fade) g *= (pcm.length - i) / fade
    const s = Math.round(pcm[i]! * g)
    pcm[i] = s > SPEECH_PEAK_CEILING ? SPEECH_PEAK_CEILING : s < -SPEECH_PEAK_CEILING ? -SPEECH_PEAK_CEILING : s
  }
  return pcm
}

export function mixLoopingBed(
  voice: Int16Array,
  bed: Int16Array,
  gain: number,
  bedOffset = 0,
): { pcm: Int16Array; nextOffset: number } {
  if (!bed.length || gain <= 0) return { pcm: voice, nextOffset: bedOffset }
  const n = bed.length
  /** Fade-in uniquement au tout début de séance, pour que le fond reste continu pendant les pauses. */
  const fadeIn = bedOffset === 0 ? Math.min(Math.round(0.8 * SAMPLE_RATE), voice.length) : 0
  const xfade = Math.min(Math.floor(n / 4), Math.round(0.12 * SAMPLE_RATE))
  /** Légère baisse de la voix → évite le clip (= grésillement) quand le lit s’ajoute. */
  const voiceScale = 0.88
  let offset = ((bedOffset % n) + n) % n
  for (let i = 0; i < voice.length; i++) {
    const fadeGain = fadeIn > 0 && i < fadeIn ? (i / fadeIn) * gain : gain
    const j = offset
    let b = bed[j]!
    if (xfade > 0 && j < xfade) {
      const t = j / xfade
      b = bed[n - xfade + j]! * (1 - t) + b * t
    }
    const mixed = voice[i]! * voiceScale + b * fadeGain
    voice[i] = mixed > 32767 ? 32767 : mixed < -32768 ? -32768 : mixed
    offset = (offset + 1) % n
  }
  return { pcm: voice, nextOffset: offset }
}

type Mp3EncoderInstance = {
  encodeBuffer: (s: Int16Array) => Int8Array
  flush: () => Int8Array
}

let Mp3EncoderCtor: (new (ch: number, rate: number, kbps: number) => Mp3EncoderInstance) | null =
  null

async function lameEncoder(): Promise<Mp3EncoderInstance> {
  if (!Mp3EncoderCtor) {
    const lame = new Function(`${LAME_SRC}\nreturn lamejs;`)() as {
      Mp3Encoder: new (ch: number, rate: number, kbps: number) => Mp3EncoderInstance
    }
    if (!lame?.Mp3Encoder) throw new Error('lamejs Mp3Encoder introuvable')
    Mp3EncoderCtor = lame.Mp3Encoder
  }
  return new Mp3EncoderCtor(1, SAMPLE_RATE, 128)
}

const AI_MP3_COMMENT =
  'Contenu audio généré artificiellement par Visiora. Voix de synthèse.'

function latin1(text: string): Uint8Array {
  const out = new Uint8Array(text.length)
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    out[i] = code < 256 ? code : 0x3f
  }
  return out
}

function id3v23Frame(id: string, body: Uint8Array): Uint8Array {
  const frame = new Uint8Array(10 + body.length)
  frame.set(latin1(id), 0)
  frame[4] = (body.length >>> 24) & 0xff
  frame[5] = (body.length >>> 16) & 0xff
  frame[6] = (body.length >>> 8) & 0xff
  frame[7] = body.length & 0xff
  frame.set(body, 10)
  return frame
}

function syncsafeSize(size: number): Uint8Array {
  return new Uint8Array([
    (size >>> 21) & 0x7f,
    (size >>> 14) & 0x7f,
    (size >>> 7) & 0x7f,
    size & 0x7f,
  ])
}

/**
 * Étiquette ID3v2.3 en tête du MP3 assemblé.
 * TXXX AI_GENERATED=1 est le champ machine. COMM est la phrase en français.
 * Ce n’est pas un certificat C2PA : une ré-encodage peut retirer l’étiquette.
 */
export function withAiDisclosureTag(mp3: Uint8Array): Uint8Array {
  if (mp3.length >= 3 && mp3[0] === 0x49 && mp3[1] === 0x44 && mp3[2] === 0x33) return mp3

  const comment = latin1(AI_MP3_COMMENT)
  const comm = new Uint8Array(1 + 3 + 1 + comment.length)
  comm[0] = 0
  comm.set(latin1('fre'), 1)
  comm[4] = 0
  comm.set(comment, 5)

  const desc = latin1('AI_GENERATED')
  const value = latin1('1')
  const txxx = new Uint8Array(1 + desc.length + 1 + value.length)
  txxx[0] = 0
  txxx.set(desc, 1)
  txxx[1 + desc.length] = 0
  txxx.set(value, 2 + desc.length)

  const frames = concatBytes([id3v23Frame('TXXX', txxx), id3v23Frame('COMM', comm)])
  const tag = new Uint8Array(10 + frames.length)
  tag.set(latin1('ID3'), 0)
  tag[3] = 3
  tag[4] = 0
  tag.set(syncsafeSize(frames.length), 6)
  tag.set(frames, 10)

  const out = new Uint8Array(tag.length + mp3.length)
  out.set(tag, 0)
  out.set(mp3, tag.length)
  return out
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

const MP3_FRAME = 1152

export type Mp3Stream = {
  write(pcm: Int16Array): void
  finish(): Uint8Array
}

/** Un seul encodeur pour toute la séance : les fondus de 15 ms restent dans le MP3. */
export async function createMp3Stream(): Promise<Mp3Stream> {
  const encoder = await lameEncoder()
  const chunks: Uint8Array[] = []
  let pending = new Int16Array(0)

  function pushFrame(block: Int16Array) {
    const copy = new Int16Array(MP3_FRAME)
    copy.set(block.subarray(0, MP3_FRAME))
    const buf = encoder.encodeBuffer(copy)
    if (buf.length) chunks.push(Uint8Array.from(buf))
  }

  return {
    write(pcm: Int16Array) {
      const merged = new Int16Array(pending.length + pcm.length)
      merged.set(pending, 0)
      merged.set(pcm, pending.length)
      const full = merged.length - (merged.length % MP3_FRAME)
      for (let i = 0; i < full; i += MP3_FRAME) pushFrame(merged.subarray(i, i + MP3_FRAME))
      const rest = merged.length - full
      pending = new Int16Array(rest)
      if (rest) pending.set(merged.subarray(full))
    },
    finish() {
      if (pending.length) {
        const pad = new Int16Array(MP3_FRAME)
        pad.set(pending)
        pushFrame(pad)
        pending = new Int16Array(0)
      }
      const tail = encoder.flush()
      if (tail.length) chunks.push(Uint8Array.from(tail))
      return concatBytes(chunks)
    },
  }
}

export async function encodeMp3(pcm: Int16Array): Promise<Uint8Array> {
  const stream = await createMp3Stream()
  stream.write(pcm)
  return stream.finish()
}
