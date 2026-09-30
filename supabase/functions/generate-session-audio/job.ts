/** Plan de génération audio découpé (une étape = un invoc Edge Function). */

import {
  chunkSpeech,
  longSessionParts,
  partsForDuration,
  type PacingMode,
} from './script.ts'

export const JOB_VERSION = 9
/** Repère affiché dans l’admin. Le texte du prompt reste le secret. */
export const PROMPT_VERSION = '1.2'
/** Une pause CDC = un step. v8 : WAV par segment, un seul MP3 à la fin. */
export const SILENCE_SLICE_SECONDS = 12
/** Après le dernier bloc voix : fond seul, puis fondu. Toutes les séances. */
export const OUTRO_HOLD_SECONDS = 4
export const OUTRO_FADE_SECONDS = 4

/** Steps compacts (sans texte) → JSON léger, moins de risques d’échec d’update. */
export type JobStep =
  | { kind: 'speech'; partPath?: string; requestId?: string }
  | { kind: 'silence'; seconds: number; fadeOut?: boolean; partPath?: string }

export type AudioJob = {
  version: number
  voiceKey: string
  steps: JobStep[]
  nextIndex: number
  totalSpeech: number
  doneSpeech: number
  previousRequestIds: string[]
  /** Premier bloc voix de la séance : tous les suivants s’y rattachent. */
  anchorRequestIds?: string[]
  /** Même tirage pour tous les blocs voix de cette séance. */
  seed?: number
  bedOffset: number
  claimId: string | null
  claimedAt: string | null
  phase: 'tts' | 'finalize' | 'done'
  handedToN8n?: boolean
  /** Montage final : prochain segment, et offset dans ce segment si la passe s’est arrêtée au milieu. */
  mixCursor?: number
  mixSample?: number
  /** Nombre de MP3 partiels déjà écrits. */
  mixPart?: number
  /** Échantillons PCM (< 1 frame MP3) en attente du morceau suivant. */
  mixCarry?: string
  /** Présent à partir de la v7 : durée choisie, pour recalculer les blancs. */
  durationMinutes?: number
  /** Mesures d’usage. Pas le contenu de la séance. */
  promptVersion?: string
  scriptWords?: number
  ttsChars?: number
  startedAt?: string
  finishedAt?: string
  error?: string
}

type FullStep =
  | { kind: 'speech'; text: string }
  | { kind: 'silence'; seconds: number; fadeOut?: boolean }

function pacingForJobVersion(version: number): PacingMode {
  return version >= 9 ? 'paragraph' : 'sentence'
}

export function buildFullSteps(
  script: string,
  minutes = 0,
  jobVersion = JOB_VERSION,
): FullStep[] {
  const mode = pacingForJobVersion(jobVersion)
  const parts = minutes > 0 ? partsForDuration(script, mode) : longSessionParts(script, mode)
  const steps: FullStep[] = []
  for (const part of parts) {
    if (part.kind === 'silence') {
      let left = part.seconds
      while (left > 0) {
        const slice = Math.min(SILENCE_SLICE_SECONDS, left)
        steps.push({ kind: 'silence', seconds: slice })
        left -= slice
      }
      continue
    }
    for (const text of chunkSpeech(part.text)) {
      steps.push({ kind: 'speech', text })
    }
  }
  steps.push({ kind: 'silence', seconds: OUTRO_HOLD_SECONDS })
  steps.push({ kind: 'silence', seconds: OUTRO_FADE_SECONDS, fadeOut: true })
  return steps
}

export function speechTextAt(
  script: string,
  index: number,
  minutes = 0,
  jobVersion = JOB_VERSION,
): string {
  const full = buildFullSteps(script, minutes, jobVersion)
  const step = full[index]
  if (!step || step.kind !== 'speech') {
    throw new Error(`Pas de texte speech à l’index ${index}`)
  }
  return step.text
}

export function createAudioJob(script: string, voiceKey: string, minutes = 15): AudioJob {
  const durationMinutes = minutes === 3 || minutes === 10 || minutes === 15 ? minutes : 15
  const full = buildFullSteps(script, durationMinutes, JOB_VERSION)
  const steps: JobStep[] = full.map((s) =>
    s.kind === 'speech'
      ? { kind: 'speech' }
      : { kind: 'silence', seconds: s.seconds, ...(s.fadeOut ? { fadeOut: true } : {}) },
  )
  const totalSpeech = Math.max(1, steps.filter((s) => s.kind === 'speech').length)
  return {
    version: JOB_VERSION,
    voiceKey,
    steps,
    nextIndex: 0,
    totalSpeech,
    doneSpeech: 0,
    previousRequestIds: [],
    anchorRequestIds: [],
    seed: Math.floor(Math.random() * 4294967295),
    bedOffset: 0,
    claimId: null,
    claimedAt: null,
    phase: 'tts',
    durationMinutes,
    promptVersion: PROMPT_VERSION,
    startedAt: new Date().toISOString(),
    scriptWords: script
      .replace(/\[[^\]]*\]/g, ' ')
      .split(/\s+/)
      .filter(Boolean).length,
    ttsChars: 0,
  }
}

export function isAudioJob(value: unknown): value is AudioJob {
  if (!value || typeof value !== 'object') return false
  const job = value as AudioJob
  return (
    (job.version === 6 ||
      job.version === 7 ||
      job.version === 8 ||
      job.version === 9) &&
    Array.isArray(job.steps) &&
    typeof job.nextIndex === 'number' &&
    (job.phase === 'tts' || job.phase === 'finalize' || job.phase === 'done')
  )
}

/**
 * La voix occupe environ 18 → 64, le montage final 64 → 99.
 * Avant, le montage entier tenait dans 94 → 99 : la barre semblait bloquée à 95–98.
 */
export function progressPct(job: AudioJob): number {
  if (job.phase === 'done') return 100
  const total = Math.max(1, job.steps.length)
  if (job.phase === 'finalize') {
    const cursor = Math.max(0, Math.min(total, job.mixCursor ?? 0))
    return Math.min(99, Math.round(64 + (cursor / total) * 35))
  }
  const ratio = Math.min(1, job.nextIndex / total)
  return Math.round(18 + ratio * 46)
}

export function partPath(userId: string, sessionId: string, index: number, version: number): string {
  const ext = version >= 8 ? 'wav' : 'mp3'
  return `${userId}/${sessionId}/parts/${String(index).padStart(4, '0')}.${ext}`
}

export function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.byteLength, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    out.set(c, offset)
    offset += c.byteLength
  }
  return out
}
