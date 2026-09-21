/** Plan de génération audio découpé (une étape = un invoc Edge Function). */

import { chunkSpeech, longSessionParts, type ScriptPart } from './script.ts'

export const JOB_VERSION = 6
/** Une pause CDC = un step (MP3 pré-encodé, plus de découpe lame.js). */
export const SILENCE_SLICE_SECONDS = 12

/** Steps compacts (sans texte) → JSON léger, moins de risques d’échec d’update. */
export type JobStep =
  | { kind: 'speech'; partPath?: string; requestId?: string }
  | { kind: 'silence'; seconds: number; partPath?: string }

export type AudioJob = {
  version: number
  voiceKey: string
  steps: JobStep[]
  nextIndex: number
  totalSpeech: number
  doneSpeech: number
  previousRequestIds: string[]
  bedOffset: number
  claimId: string | null
  claimedAt: string | null
  phase: 'tts' | 'finalize' | 'done'
}

type FullStep =
  | { kind: 'speech'; text: string }
  | { kind: 'silence'; seconds: number }

export function buildFullSteps(script: string): FullStep[] {
  const parts = longSessionParts(script)
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
  return steps
}

export function speechTextAt(script: string, index: number): string {
  const full = buildFullSteps(script)
  const step = full[index]
  if (!step || step.kind !== 'speech') {
    throw new Error(`Pas de texte speech à l’index ${index}`)
  }
  return step.text
}

export function createAudioJob(script: string, voiceKey: string): AudioJob {
  const full = buildFullSteps(script)
  const steps: JobStep[] = full.map((s) =>
    s.kind === 'speech' ? { kind: 'speech' } : { kind: 'silence', seconds: s.seconds },
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
    bedOffset: 0,
    claimId: null,
    claimedAt: null,
    phase: 'tts',
  }
}

export function isAudioJob(value: unknown): value is AudioJob {
  if (!value || typeof value !== 'object') return false
  const job = value as AudioJob
  return (
    job.version === JOB_VERSION &&
    Array.isArray(job.steps) &&
    typeof job.nextIndex === 'number' &&
    (job.phase === 'tts' || job.phase === 'finalize' || job.phase === 'done')
  )
}

/** Progression sur les steps (silences inclus) → le % bouge dès le début. */
export function progressPct(job: AudioJob): number {
  if (job.phase === 'done') return 100
  if (job.phase === 'finalize') return 94
  const total = Math.max(1, job.steps.length)
  const ratio = Math.min(1, job.nextIndex / total)
  return Math.round(5 + ratio * 88)
}

export function partPath(userId: string, sessionId: string, index: number): string {
  return `${userId}/${sessionId}/parts/${String(index).padStart(4, '0')}.mp3`
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

export type { ScriptPart }
