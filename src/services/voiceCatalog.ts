import { VOICES } from '@/data/wizard'
import { isSupabaseConfigured, supabase, supabaseAdmin } from './supabase'

export type VoiceSlot = {
  slot: string
  label: string
  elevenVoiceId: string
  bed: string
  bedLabel: string
  previewUrl: string | null
  dryUrl: string | null
}

type SlotRow = {
  slot: string
  label: string
  eleven_voice_id: string
  bed: string
  bed_label?: string | null
  preview_url: string | null
  dry_url: string | null
}

function mapRow(row: SlotRow): VoiceSlot {
  return {
    slot: row.slot,
    label: row.label,
    elevenVoiceId: row.eleven_voice_id,
    bed: row.bed,
    bedLabel: row.bed_label?.trim() || 'Sleep Music',
    previewUrl: row.preview_url,
    dryUrl: row.dry_url,
  }
}

export type VoiceOffer = {
  id: string
  name: string
  description: string
  gender: string
  tag: string
  ambiance: null
  preview: string
  dry: string
}

export function offersFromSlots(slots: VoiceSlot[]): VoiceOffer[] {
  const known = new Set<string>(VOICES.map((voice) => voice.id))
  const current = VOICES.map((voice) => {
    const row = slots.find((item) => item.slot === voice.id)
    const base: VoiceOffer = {
      id: voice.id,
      name: voice.name,
      description: voice.description,
      gender: voice.gender,
      tag: voice.tag,
      ambiance: null,
      preview: voice.preview,
      dry: voice.dry,
    }
    if (!row) return base
    return {
      ...base,
      name: row.label || voice.name,
      preview: row.previewUrl || voice.preview,
      dry: row.dryUrl || voice.dry,
    }
  })
  const added = slots
    .filter((row) => !known.has(row.slot) && row.label && row.previewUrl && row.dryUrl)
    .map((row) => ({
      id: row.slot,
      name: row.label,
      description: '',
      gender: '',
      tag: '',
      ambiance: null as null,
      preview: row.previewUrl || '',
      dry: row.dryUrl || '',
    }))
  return [...current, ...added]
}

const BED_PATH = /^custom\/(?:aurore|steve|v\d{10,16})-\d{10,16}\.wav$/

async function readFunctionError(error: unknown): Promise<string> {
  const context = error && typeof error === 'object' && 'context' in error ? error.context : null
  if (context instanceof Response) {
    try {
      const body = (await context.clone().json()) as { error?: unknown }
      if (typeof body?.error === 'string' && body.error.trim()) return body.error
    } catch {
      /* corps vide ou non JSON */
    }
    return `Le serveur a répondu ${context.status}`
  }
  if (error instanceof Error && error.message && !error.message.includes('non-2xx')) return error.message
  return 'L’enregistrement a été refusé par le serveur'
}

export const voiceCatalogService = {
  async list(admin = false): Promise<VoiceSlot[]> {
    const client = admin ? supabaseAdmin : supabase
    if (!isSupabaseConfigured() || !client) return []
    const { data, error } = await client
      .from('voice_slots')
      .select('slot, label, eleven_voice_id, bed, bed_label, preview_url, dry_url')
      .order('slot')
    if (error || !data) return []
    return (data as SlotRow[]).map(mapRow)
  },

  async save(input: {
    slot: string
    label: string
    elevenVoiceId: string
    bed: string
    bedLabel: string
  }): Promise<VoiceSlot> {
    if (!isSupabaseConfigured() || !supabaseAdmin) {
      throw new Error('Supabase non configuré')
    }
    const { data, error } = await supabaseAdmin.functions.invoke<{
      ok?: boolean
      error?: string
      slot?: SlotRow
    }>('admin-voice-studio', { body: input })
    if (data?.error) throw new Error(data.error)
    if (error) throw new Error(await readFunctionError(error))
    if (!data?.slot) throw new Error('Enregistrement incomplet')
    return mapRow(data.slot)
  },

  /** Le fichier est calé tout seul sur les niveaux de cette voix. L’autre voix ne change pas. */
  async uploadBed(file: File, row: VoiceSlot): Promise<VoiceSlot> {
    if (!isSupabaseConfigured() || !supabaseAdmin) {
      throw new Error('Supabase non configuré')
    }
    const wav = await audioFileToWav(file)
    const stamp = Date.now()
    const path = `custom/${row.slot}-${stamp}.wav`
    if (!BED_PATH.test(path)) throw new Error('Fichier de fond refusé')
    const { error } = await supabaseAdmin.storage.from('beds').upload(path, wav, {
      contentType: 'audio/wav',
      upsert: false,
    })
    if (error) throw new Error(error.message)
    const bedLabel = file.name.replace(/\.[^.]+$/, '').trim().slice(0, 48) || 'Fond'
    return this.save({
      slot: row.slot,
      label: row.label,
      elevenVoiceId: row.elevenVoiceId,
      bed: path,
      bedLabel,
    })
  },
}

async function audioFileToWav(file: File): Promise<Blob> {
  if (file.size < 1000) throw new Error('Fichier audio trop court')
  if (file.size > 40 * 1024 * 1024) throw new Error('Fichier trop lourd (40 Mo maximum)')
  const context = new AudioContext()
  try {
    const decoded = await context.decodeAudioData(await file.arrayBuffer())
    if (decoded.duration < 8) throw new Error('Le fond doit durer au moins 8 secondes')
    if (decoded.duration > 7 * 60) throw new Error('Le fond doit durer 7 minutes au plus')
    const rate = 44100
    const length = Math.ceil(decoded.duration * rate)
    const offline = new OfflineAudioContext(1, length, rate)
    const source = offline.createBufferSource()
    source.buffer = decoded
    source.connect(offline.destination)
    source.start()
    const rendered = await offline.startRendering()
    return encodeWav(rendered.getChannelData(0), rate)
  } catch (err) {
    if (err instanceof Error && /fond|Fichier|court|lourd|minutes|secondes/.test(err.message)) throw err
    throw new Error('Ce fichier audio ne peut pas être lu')
  } finally {
    await context.close()
  }
}

function encodeWav(samples: Float32Array, rate: number): Blob {
  const n = samples.length
  const buffer = new ArrayBuffer(44 + n * 2)
  const view = new DataView(buffer)
  const write = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  write(0, 'RIFF')
  view.setUint32(4, 36 + n * 2, true)
  write(8, 'WAVE')
  write(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  write(36, 'data')
  view.setUint32(40, n * 2, true)
  let offset = 44
  for (let i = 0; i < n; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i] ?? 0))
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
    offset += 2
  }
  return new Blob([buffer], { type: 'audio/wav' })
}
