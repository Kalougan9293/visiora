/** Parse le format Annexe 1 et découpe le texte pour la synthèse vocale. */

import { ANNEX_FIXTURE_SCRIPT } from './annex.ts'

export const PAUSE_SHORT_SECONDS = 3
/** CDC : pause longue ≈ 9 s */
export const PAUSE_LONG_SECONDS = 9
export const TTS_CHUNK_CHARS = 3500

export type ScriptPart =
  | { kind: 'speech'; text: string }
  | { kind: 'silence'; seconds: number }

const MARKER = /\[pause longue\]|\[pause\]/gi
/** Titres de mouvement : affichage seul, jamais lus */
const MOVEMENT_LINE = /\[Mouvement[^\]]*\]/gi

function stripDisplayOnly(raw: string): string {
  return raw.replace(MOVEMENT_LINE, ' ')
}

function mergeSilences(parts: ScriptPart[]): ScriptPart[] {
  const out: ScriptPart[] = []
  for (const part of parts) {
    const prev = out[out.length - 1]
    if (part.kind === 'silence' && prev?.kind === 'silence') {
      prev.seconds += part.seconds
    } else {
      out.push(part.kind === 'silence' ? { ...part } : part)
    }
  }
  return out
}

export function parseAnnexScript(raw: string): ScriptPart[] {
  const text = stripDisplayOnly(raw.replace(/\r\n/g, '\n'))
  const parts: ScriptPart[] = []
  let last = 0

  for (const match of text.matchAll(MARKER)) {
    const start = match.index ?? 0
    const before = text.slice(last, start).replace(/\s+/g, ' ').trim()
    if (before) parts.push({ kind: 'speech', text: before })
    const token = match[0].toLowerCase()
    parts.push({
      kind: 'silence',
      seconds: token.includes('longue') ? PAUSE_LONG_SECONDS : PAUSE_SHORT_SECONDS,
    })
    last = start + match[0].length
  }

  const tail = text.slice(last).replace(/\s+/g, ' ').trim()
  if (tail) parts.push({ kind: 'speech', text: tail })
  return mergeSilences(parts)
}

export function chunkSpeech(text: string, max = TTS_CHUNK_CHARS): string[] {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return []
  if (clean.length <= max) return [clean]

  const chunks: string[] = []
  let rest = clean
  while (rest.length > max) {
    const window = rest.slice(0, max)
    const splitAt = Math.max(
      window.lastIndexOf('. '),
      window.lastIndexOf('? '),
      window.lastIndexOf('! '),
      window.lastIndexOf('; '),
      window.lastIndexOf(', '),
    )
    const cut = splitAt > max * 0.4 ? splitAt + 1 : max
    chunks.push(rest.slice(0, cut).trim())
    rest = rest.slice(cut).trim()
  }
  if (rest) chunks.push(rest)
  return chunks
}

export function resolveScript(session: { script?: string | null }): string {
  if (typeof session.script === 'string' && session.script.trim().length > 40) {
    return session.script.trim()
  }
  return ANNEX_FIXTURE_SCRIPT
}
