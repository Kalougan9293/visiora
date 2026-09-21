/** Mixe un lit d’ambiance sous la voix PCM, puis encode MP3. */

import { LAME_SRC } from './assets.ts'
import {
  RITUEL_LOOP_WAV,
  ONDE_LOOP_WAV,
  ANTONI_LOOP_WAV,
  RITUEL_3S_MP3,
  ONDE_3S_MP3,
  ANTONI_3S_MP3,
  RITUEL_9S_MP3,
  ONDE_9S_MP3,
  ANTONI_9S_MP3,
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

const BED_SILENCE_B64: Record<string, { s3: string; s9: string }> = {
  rituel: { s3: RITUEL_3S_MP3, s9: RITUEL_9S_MP3 },
  onde: { s3: ONDE_3S_MP3, s9: ONDE_9S_MP3 },
  antoni: { s3: ANTONI_3S_MP3, s9: ANTONI_9S_MP3 },
}

/** Volume bas : tapis discret, sans clip avec la voix. */
const BED_GAIN: Record<string, number> = {
  rituel: 0.16,
  onde: 0.14,
  antoni: 0.12,
}

type LoadedBed = { key: string; pcm: Int16Array; gain: number }
let bedCache: LoadedBed | null = null
const silenceMp3Cache = new Map<string, Uint8Array>()

export async function loadBed(appVoiceKey: string): Promise<{ pcm: Int16Array; gain: number } | null> {
  const key = appVoiceKey.toLowerCase()
  const b64 = BED_WAV_B64[key]
  const gain = BED_GAIN[key]
  if (!b64 || gain == null) return null
  if (bedCache?.key === key) return bedCache
  try {
    const pcm = pcmFromWav(b64ToBytes(b64))
    bedCache = { key, pcm, gain }
    return bedCache
  } catch (err) {
    console.warn('[mix] bed missing', key, err)
    return null
  }
}

function silenceTile(key: string, longPause: boolean): Uint8Array | null {
  const pack = BED_SILENCE_B64[key]
  if (!pack) return null
  const cacheKey = `${key}:${longPause ? 9 : 3}`
  const cached = silenceMp3Cache.get(cacheKey)
  if (cached) return cached
  try {
    const bytes = b64ToBytes(longPause ? pack.s9 : pack.s3)
    silenceMp3Cache.set(cacheKey, bytes)
    return bytes
  } catch (err) {
    console.warn('[mix] silence tile missing', cacheKey, err)
    return null
  }
}

/** Silence d’ambiance pré-encodé (pas de lame.js). 3 s ou 9 s CDC, sinon tuile 3 s répétée.
 *  Les blancs < 2,5 s sont mixés en live (tuile 3 s trop longue pour une virgule / un point). */
export async function silenceBedMp3(appVoiceKey: string, seconds: number): Promise<Uint8Array | null> {
  if (seconds < 2.5) return null
  const key = appVoiceKey.toLowerCase()
  const rounded = Math.max(1, Math.round(seconds))
  if (rounded >= 8) {
    const longTile = silenceTile(key, true)
    if (longTile) return longTile
  }
  const shortTile = silenceTile(key, false)
  if (!shortTile) return null
  if (rounded <= 4) return shortTile
  const copies = Math.max(1, Math.round(rounded / 3))
  const total = shortTile.byteLength * copies
  const out = new Uint8Array(total)
  for (let i = 0; i < copies; i++) out.set(shortTile, i * shortTile.byteLength)
  return out
}

function concatInt16(parts: Int16Array[]): Int16Array {
  const total = parts.reduce((n, p) => n + p.length, 0)
  const out = new Int16Array(total)
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function readU32(bytes: Uint8Array, i: number) {
  return bytes[i]! | (bytes[i + 1]! << 8) | (bytes[i + 2]! << 16) | (bytes[i + 3]! << 24)
}

function readU16(bytes: Uint8Array, i: number) {
  return bytes[i]! | (bytes[i + 1]! << 8)
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

export async function encodeMp3(pcm: Int16Array): Promise<Uint8Array> {
  const encoder = await lameEncoder()
  const frame = 1152
  const pad = new Int16Array(frame)
  const chunks: Uint8Array[] = []
  for (let i = 0; i < pcm.length; i += frame) {
    const end = Math.min(i + frame, pcm.length)
    let block: Int16Array
    if (end - i === frame) {
      block = pcm.subarray(i, end)
    } else {
      pad.fill(0)
      pad.set(pcm.subarray(i, end))
      block = pad
    }
    const buf = encoder.encodeBuffer(block)
    if (buf.length) chunks.push(Uint8Array.from(buf))
  }
  const tail = encoder.flush()
  if (tail.length) chunks.push(Uint8Array.from(tail))
  const total = chunks.reduce((n, c) => n + c.byteLength, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.byteLength
  }
  return out
}

export function concatPcm(parts: Int16Array[]): Int16Array {
  return concatInt16(parts)
}
