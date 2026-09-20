/** Mixe un lit d’ambiance sous la voix PCM, puis encode MP3. */

import { LAME_SRC, ONDE_WAV_B64, RITUEL_WAV_B64, b64ToBytes } from './assets.ts'

const SAMPLE_RATE = 44100
const TTS_RATE = 24000

export const TTS_PCM_FORMAT = 'pcm_24000'

export async function loadBed(appVoiceKey: string): Promise<{ pcm: Int16Array; gain: number } | null> {
  const key = appVoiceKey.toLowerCase()
  try {
    if (key === 'rituel') {
      /** Aligné sur le volume preview oiseaux (ambiance.ts ≈ 0.16). */
      return { pcm: pcmFromWav(b64ToBytes(RITUEL_WAV_B64)), gain: 0.16 }
    }
    if (key === 'onde') {
      /** Aligné sur le volume preview eau (ambiance.ts ≈ 0.22). */
      return { pcm: pcmFromWav(b64ToBytes(ONDE_WAV_B64)), gain: 0.2 }
    }
  } catch (err) {
    console.warn('[mix] bed missing', key, err)
  }
  return null
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
  const out = new Int16Array(voice.length)
  const n = bed.length
  const fade = Math.min(SAMPLE_RATE, voice.length)
  const xfade = Math.min(Math.floor(n / 4), Math.round(0.12 * SAMPLE_RATE))
  /** Légère baisse de la voix → évite le clip (= grésillement) quand le lit s’ajoute. */
  const voiceScale = 0.9
  let offset = ((bedOffset % n) + n) % n
  for (let i = 0; i < voice.length; i++) {
    const fadeGain = i < fade ? (i / fade) * gain : gain
    const j = offset
    let b = bed[j]!
    if (xfade > 0 && j < xfade) {
      const t = j / xfade
      b = bed[n - xfade + j]! * (1 - t) + b * t
    }
    const mixed = voice[i]! * voiceScale + b * fadeGain
    out[i] = mixed > 32767 ? 32767 : mixed < -32768 ? -32768 : mixed
    offset = (offset + 1) % n
  }
  return { pcm: out, nextOffset: offset }
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
  const chunks: Uint8Array[] = []
  for (let i = 0; i < pcm.length; i += frame) {
    const slice = pcm.subarray(i, Math.min(i + frame, pcm.length))
    const block =
      slice.length === frame
        ? slice
        : (() => {
            const pad = new Int16Array(frame)
            pad.set(slice)
            return pad
          })()
    const buf = encoder.encodeBuffer(block)
    if (buf.length) chunks.push(new Uint8Array(buf))
  }
  const end = encoder.flush()
  if (end.length) chunks.push(new Uint8Array(end))
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
