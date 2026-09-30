/** Parse le format Annexe 1 et découpe le texte pour la synthèse vocale. */

export const PAUSE_SHORT_SECONDS = 3
/** CDC : pause longue ≈ 9 s */
export const PAUSE_LONG_SECONDS = 9
/** Petit blanc après souffle / affirmation (plus de découpe phrase à phrase). */
export const SENTENCE_PAUSE_SECONDS = 1
/** Blanc entre deux paragraphes. */
export const PARAGRAPH_PAUSE_SECONDS = 1.8
/** Après une consigne de souffle. */
export const BREATH_PAUSE_SECONDS = 2.4
/** Après une affirmation entre guillemets — un rien de plus, pas une plage vide. */
const AFFIRMATION_EXTRA_SECONDS = 1.2
/** Entre deux mouvements, seulement si le script n’a pas déjà posé une pause. */
const MOVEMENT_HOLD_SECONDS = 2.5
/**
 * Plafond caractères par appel TTS. Assez haut pour garder un paragraphe entier ;
 * au-delà on recoupe sur une fin de phrase (continuité > micro-découpe).
 */
export const TTS_CHUNK_CHARS = 900

export type PacingMode = 'sentence' | 'paragraph'

export type ScriptPart =
  | { kind: 'speech'; text: string }
  | { kind: 'silence'; seconds: number }

const MARKER = /\[pause longue\]|\[pause\]/gi
/** Titres de mouvement : affichage seul, jamais lus */
const MOVEMENT_LINE = /\[Mouvement[^\]]*\]/gi
/** Marqueur fallback annexe : affichage seul, jamais lu */
const ANNEX_MARK = /\[Annexe[^\]]*\]/gi

function stripDisplayOnly(raw: string): string {
  return raw.replace(MOVEMENT_LINE, ' ').replace(ANNEX_MARK, ' ')
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

function isAffirmation(text: string): boolean {
  return /[«"]/.test(text)
}

function gapSeconds(sentence: string, base: number): number {
  return isAffirmation(sentence) ? base + AFFIRMATION_EXTRA_SECONDS : base
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

/**
 * Ancien mode (jobs < v9) : une phrase = un appel TTS.
 * Conserve le comportement pour les générations déjà lancées.
 */
function expandPacingBySentence(parts: ScriptPart[]): ScriptPart[] {
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
            seconds: gapSeconds(
              sentence,
              isBreathCue(sentence) ? BREATH_PAUSE_SECONDS : SENTENCE_PAUSE_SECONDS,
            ),
          })
          return
        }
        if (!lastPara) {
          out.push({
            kind: 'silence',
            seconds: gapSeconds(
              sentence,
              isBreathCue(sentence)
                ? Math.max(BREATH_PAUSE_SECONDS, PARAGRAPH_PAUSE_SECONDS)
                : PARAGRAPH_PAUSE_SECONDS,
            ),
          })
          return
        }
        if (isBreathCue(sentence) || isAffirmation(sentence)) {
          out.push({
            kind: 'silence',
            seconds: gapSeconds(
              sentence,
              isBreathCue(sentence) ? BREATH_PAUSE_SECONDS : SENTENCE_PAUSE_SECONDS,
            ),
          })
        }
      })
    })
  }
  return mergeSilences(out)
}

/**
 * Mode v9+ : un paragraphe = un appel TTS (ton / rythme / volume plus stables).
 * On ne coupe qu’après une consigne de souffle ou une affirmation, pour garder
 * les blancs volontaires du CDC.
 */
function expandPacingByParagraph(parts: ScriptPart[]): ScriptPart[] {
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
      let buffer: string[] = []
      const flush = () => {
        if (!buffer.length) return
        out.push({ kind: 'speech', text: softenCommas(buffer.join(' ')) })
        buffer = []
      }
      sentences.forEach((sentence, si) => {
        buffer.push(sentence)
        const lastInPara = si === sentences.length - 1
        const lastPara = pi === paragraphs.length - 1
        const holdAfter =
          isBreathCue(sentence) || isAffirmation(sentence)

        if (!lastInPara && holdAfter) {
          flush()
          out.push({
            kind: 'silence',
            seconds: gapSeconds(
              sentence,
              isBreathCue(sentence) ? BREATH_PAUSE_SECONDS : SENTENCE_PAUSE_SECONDS,
            ),
          })
          return
        }
        if (!lastInPara) return

        flush()
        if (!lastPara) {
          out.push({
            kind: 'silence',
            seconds: gapSeconds(
              sentence,
              isBreathCue(sentence)
                ? Math.max(BREATH_PAUSE_SECONDS, PARAGRAPH_PAUSE_SECONDS)
                : PARAGRAPH_PAUSE_SECONDS,
            ),
          })
          return
        }
        if (holdAfter) {
          out.push({
            kind: 'silence',
            seconds: gapSeconds(
              sentence,
              isBreathCue(sentence) ? BREATH_PAUSE_SECONDS : SENTENCE_PAUSE_SECONDS,
            ),
          })
        }
      })
    })
  }
  return mergeSilences(out)
}

/** Insère les blancs paragraphe / respiration, sans changer le débit de la voix. */
export function expandPacing(
  parts: ScriptPart[],
  mode: PacingMode = 'paragraph',
): ScriptPart[] {
  return mode === 'sentence' ? expandPacingBySentence(parts) : expandPacingByParagraph(parts)
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

/** Séance longue : pauses CDC + blancs paragraphe / souffle. */
export function longSessionParts(
  script: string,
  mode: PacingMode = 'paragraph',
): ScriptPart[] {
  return expandPacing(parseAnnexScript(script), mode)
}

function splitMovements(script: string): string[] {
  const parts = script
    .split(/(?=\[Mouvement[^\]]*\])/i)
    .map((part) => part.trim())
    .filter(Boolean)
  return parts.length ? parts : [script]
}

/**
 * Le rythme de la voix reste celui d’une séance parlée.
 * On n’étire pas avec de longues plages vides : juste un court maintien
 * entre les mouvements, si le script n’en a pas déjà posé un.
 */
export function partsForDuration(
  script: string,
  mode: PacingMode = 'paragraph',
): ScriptPart[] {
  const groups = splitMovements(script).map((chunk) => longSessionParts(chunk, mode))
  if (groups.length <= 1) return groups.flat()
  const out: ScriptPart[] = []
  groups.forEach((group, index) => {
    out.push(...group)
    if (index >= groups.length - 1) return
    const tail = group[group.length - 1]
    const already = tail?.kind === 'silence' ? tail.seconds : 0
    if (already < MOVEMENT_HOLD_SECONDS) {
      out.push({ kind: 'silence', seconds: MOVEMENT_HOLD_SECONDS - already })
    }
  })
  return mergeSilences(out)
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
  return ''
}
