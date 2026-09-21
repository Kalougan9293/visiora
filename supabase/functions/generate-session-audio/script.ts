/** Parse le format Annexe 1 et découpe le texte pour la synthèse vocale. */

import { ANNEX_DEMO_SHORT_SCRIPT, ANNEX_FIXTURE_SCRIPT } from './annex.ts'

export const PAUSE_SHORT_SECONDS = 3
/** CDC : pause longue ≈ 9 s */
export const PAUSE_LONG_SECONDS = 9
/** Petit blanc entre deux phrases (points). La voix ne ralentit pas. */
export const SENTENCE_PAUSE_SECONDS = 0.75
/** Blanc entre deux paragraphes. */
export const PARAGRAPH_PAUSE_SECONDS = 1.55
/** Après une consigne de souffle. */
export const BREATH_PAUSE_SECONDS = 2.0
/** Séance longue : ~20 s de voix max par invoke (évite OOM Edge / lame.js). */
export const TTS_CHUNK_CHARS = 400

export type ScriptPart =
  | { kind: 'speech'; text: string }
  | { kind: 'silence'; seconds: number }

const MARKER = /\[pause longue\]|\[pause\]/gi
/** Titres de mouvement : affichage seul, jamais lus */
const MOVEMENT_LINE = /\[Mouvement[^\]]*\]/gi

function stripDisplayOnly(raw: string): string {
  return raw.replace(MOVEMENT_LINE, ' ')
}

/** Garde les sauts de paragraphe, compacte le reste. */
function keepParagraphs(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function isBreathCue(text: string): boolean {
  return /respir|inspir|expir|souffle/i.test(text)
}

function splitSentences(paragraph: string): string[] {
  const text = paragraph.replace(/\s+/g, ' ').trim()
  if (!text) return []
  const sentences: string[] = []
  const pieces = text.split(
    /(?<=(?:[.!?]+|\.{2,}|\u2026)["»']?|:)\s+(?=[A-ZÀ-ÖØ-ÞŒÆ«"0-9])/,
  )
  for (const piece of pieces) {
    const trimmed = piece.trim()
    if (trimmed) sentences.push(trimmed)
  }
  return sentences.length ? sentences : [text]
}

/** Virgules / points-virgules : micro-souffle TTS, sans baisser le speed. */
function softenCommas(text: string): string {
  return text.replace(/;\s+/g, ' … ').replace(/,\s+/g, ', … ')
}

/** Insère les blancs phrase / paragraphe / respiration, sans changer le débit de la voix. */
export function expandPacing(parts: ScriptPart[]): ScriptPart[] {
  const out: ScriptPart[] = []
  for (const part of parts) {
    if (part.kind === 'silence') {
      out.push({ ...part })
      continue
    }
    const paragraphs = part.text
      .split(/\n{2,}/)
      .map((p) => p.replace(/\n/g, ' ').trim())
      .filter(Boolean)
    paragraphs.forEach((para, pi) => {
      const sentences = splitSentences(para)
      sentences.forEach((sentence, si) => {
        out.push({ kind: 'speech', text: softenCommas(sentence) })
        const lastInPara = si === sentences.length - 1
        const lastPara = pi === paragraphs.length - 1
        if (!lastInPara) {
          out.push({
            kind: 'silence',
            seconds: isBreathCue(sentence) ? BREATH_PAUSE_SECONDS : SENTENCE_PAUSE_SECONDS,
          })
          return
        }
        if (!lastPara) {
          out.push({
            kind: 'silence',
            seconds: isBreathCue(sentence)
              ? Math.max(BREATH_PAUSE_SECONDS, PARAGRAPH_PAUSE_SECONDS)
              : PARAGRAPH_PAUSE_SECONDS,
          })
          return
        }
        if (isBreathCue(sentence)) {
          out.push({ kind: 'silence', seconds: BREATH_PAUSE_SECONDS })
        }
      })
    })
  }
  return mergeSilences(out)
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
  const text = keepParagraphs(stripDisplayOnly(raw.replace(/\r\n/g, '\n')))
  const parts: ScriptPart[] = []
  let last = 0

  for (const match of text.matchAll(MARKER)) {
    const start = match.index ?? 0
    const before = keepParagraphs(text.slice(last, start))
    if (before) parts.push({ kind: 'speech', text: before })
    const token = match[0].toLowerCase()
    parts.push({
      kind: 'silence',
      seconds: token.includes('longue') ? PAUSE_LONG_SECONDS : PAUSE_SHORT_SECONDS,
    })
    last = start + match[0].length
  }

  const tail = keepParagraphs(text.slice(last))
  if (tail) parts.push({ kind: 'speech', text: tail })
  return mergeSilences(parts)
}

/** Séance longue : pauses CDC + blancs phrase / paragraphe / souffle. */
export function longSessionParts(script: string): ScriptPart[] {
  return expandPacing(parseAnnexScript(script))
}

/** Démo 15 s : blancs phrase / souffle dans un seul invoke. */
export function demoSessionParts(script: string): ScriptPart[] {
  return expandPacing(parseAnnexScript(script))
}

export function pacedScriptParts(script: string): ScriptPart[] {
  return longSessionParts(script)
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

/**
 * Mode démo ~15 s tant que VISIORA_AUDIO_DEMO_SHORT ≠ "0".
 * Remettre le script complet : secrets set VISIORA_AUDIO_DEMO_SHORT=0
 */
export function isDemoShortMode(): boolean {
  return Deno.env.get('VISIORA_AUDIO_DEMO_SHORT') !== '0'
}

export function resolveScript(session: { script?: string | null }): string {
  if (isDemoShortMode()) return ANNEX_DEMO_SHORT_SCRIPT

  if (typeof session.script === 'string' && session.script.trim().length > 40) {
    return session.script.trim()
  }
  return ANNEX_FIXTURE_SCRIPT
}
