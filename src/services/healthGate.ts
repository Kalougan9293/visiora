/** Écran santé CDC (p.9) — déclenché par mots-clés dans Q1 / Q7 / Q11. Pas la Q8. */

/** Un mot suffit : accents, espaces et tirets sont ignorés à la détection. */
export const HEALTH_KEYWORDS = [
  'maladie',
  'malade',
  'guérir',
  'guérison',
  'rémission',
  'diagnostic',
  'traitement',
  'cancer',
  'dépression',
  'anxiété',
  'angoisse',
  'burn-out',
  'pathologie',
  'thérapie',
  'médicament',
  'diabète',
  'hypertension',
  'asthme',
  'fibromyalgie',
  'endométriose',
  'tumeur',
  'covid',
  'AVC',
  'infarctus',
  'anorexie',
  'boulimie',
  'bipolarité',
  'TOC',
  'addiction',
  'thyroïde',
  'Alzheimer',
  'Parkinson',
  'épilepsie',
] as const

export function healthMatchKey(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[\s\-_'’]+/g, '')
    .trim()
}

/** Terminaisons courtes : malade / maladie, dépressif / dépression. Pas un dictionnaire. */
const FAMILY_ENDING = /^(e|es|s|x|f|ie|on|ion|if|ive|eux|euse|er|ir|is|ment)?$/

function healthWords(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .split(/[^a-z0-9]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4)
}

/** Même famille si l’un contient l’autre, ou si seul le bout du mot change. */
export function sameHealthFamily(word: string, keyword: string): boolean {
  if (!word || !keyword) return false
  if (word === keyword) return true
  const shorter = word.length <= keyword.length ? word : keyword
  const longer = word.length <= keyword.length ? keyword : word
  if (shorter.length >= 4 && longer.includes(shorter)) return true
  if (shorter.length < 5 || longer.length - shorter.length > 4) return false
  let shared = 0
  while (shared < shorter.length && word[shared] === keyword[shared]) shared += 1
  if (shared < 5) return false
  return FAMILY_ENDING.test(word.slice(shared)) && FAMILY_ENDING.test(keyword.slice(shared))
}

const HEALTH_SCAN_FIELDS = ['q1', 'q7', 'q11'] as const

/** Champs hors texte libre (ne pas scanner pour la détresse). */
const DISTRESS_SKIP_FIELDS = new Set([
  'health_ack',
  'health_ack_at',
  'q6_scale',
  'q12_voice',
  'q12_tutoiement',
  'q12_registre',
  'q12_sans_fond',
  'duration_minutes',
  'share_read',
  'apaisement',
])

export const HEALTH_COPY = {
  title: "Avant d'entrer dans ta visualisation",
  body: "Ta séance touche à la santé et au mieux-être — un territoire précieux et intime. Prends un instant pour lire ceci. VisuaRise est un outil de bien-être et de développement personnel. Il ne remplace ni un avis médical, ni un suivi psychologique. Les images que tu vas explorer sont celles de ton imaginaire. Continue à prendre soin de toi et à t'entourer des personnes qui t'accompagnent.",
  checkbox:
    "J'accepte que les informations de santé que j'ai partagées servent uniquement à créer et conserver ma séance.",
} as const

/**
 * Détresse : arrêt net, pas de séance.
 * Expressions entières (mots côte à côte) — pas de famille morphologique ni de collage sans espaces.
 */
export const DISTRESS_KEYWORDS = [
  'suicide',
  'suicider',
  'suicidaire',
  'me suicider',
  'en finir',
  'me faire du mal',
  'me tuer',
  'mourir',
  'envie de mourir',
  'finir mes jours',
  'mettre fin à mes jours',
  'plus envie de vivre',
  'me foutre en l’air',
  'ne plus être là',
  'me supprimer',
] as const

export const DISTRESS_COPY = {
  title: 'Prends soin de toi',
  lead: 'Ce que tu écris semble lourd à porter. Tu n’as pas à traverser ça seul·e.',
  line3114:
    'Tu peux appeler le 3114, gratuitement, jour et nuit, pour parler à quelqu’un de formé à l’écoute.',
  lineUrgence: 'En cas d’urgence, appelle le 15 ou le 112.',
  apaisementLead:
    'Si tu le souhaites, VisuaRise peut te proposer une séance d’apaisement : un moment de calme et de respiration, à ton rythme. Elle ne remplace pas une aide humaine.',
  ctaApaisement: 'Créer ma séance d’apaisement',
  back: 'Revenir au questionnaire',
} as const

/** Flag neutre : type de séance, pas une trace de « détection détresse ». */
export const APAISEMENT_FLAG = 'apaisement' as const

export function isApaisementAnswers(answers: Record<string, unknown> | null | undefined): boolean {
  if (!answers || typeof answers !== 'object') return false
  const v = answers[APAISEMENT_FLAG]
  return v === '1' || v === true
}

/** Le passage par les écrans santé / détresse n’est pas une donnée à conserver. */
export function answersForStorage<T extends Record<string, unknown>>(answers: T): T {
  const next = { ...answers }
  delete next.health_ack
  delete next.health_ack_at
  return next
}

function healthScanBlob(answers: Record<string, unknown>): { hay: string; words: string[] } | null {
  const blob = HEALTH_SCAN_FIELDS.map((id) => {
    const v = answers[id]
    return typeof v === 'string' ? v : ''
  }).join(' ')
  if (!blob.trim()) return null
  return { hay: healthMatchKey(blob), words: healthWords(blob) }
}

/** Texte libre du questionnaire (toutes questions, dont Q6). */
export function distressScanText(answers: Record<string, unknown>): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(answers)) {
    if (DISTRESS_SKIP_FIELDS.has(key)) continue
    if (typeof value === 'string' && value.trim()) parts.push(value)
  }
  return parts.join('\n')
}

/** Minuscules, sans accents ; apostrophes → espace ; un seul espace entre les mots. */
export function distressNormalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/['’ʻʼ]/g, ' ')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Expression entière : mots complets côte à côte.
 * « en finir » matche, « finiront » / « envie de rencontrer » ne matchent pas.
 */
export function distressPhraseMatches(haystack: string, phrase: string): boolean {
  const hay = distressNormalize(haystack)
  const needle = distressNormalize(phrase)
  if (!hay || !needle) return false
  const parts = needle.split(' ').filter(Boolean)
  if (!parts.length) return false
  const body = parts.map(escapeRegExp).join('\\s+')
  return new RegExp(`(?:^|\\s)${body}(?=\\s|$)`).test(hay)
}

/** Expressions de la liste présentes telles quelles dans les réponses. */
export function findDistressMatches(
  answers: Record<string, unknown>,
  keywords: readonly string[] = DISTRESS_KEYWORDS,
): string[] {
  const text = distressScanText(answers)
  if (!text.trim()) return []
  const list = keywords.length ? keywords : DISTRESS_KEYWORDS
  return list.filter((kw) => distressPhraseMatches(text, kw))
}

export function answersMatchKeywords(
  answers: Record<string, unknown>,
  keywords: readonly string[],
): boolean {
  const scanned = healthScanBlob(answers)
  if (!scanned) return false
  const list = keywords.length ? keywords : []
  return list.some((kw) => {
    const key = healthMatchKey(kw)
    if (!key) return false
    if (scanned.hay.includes(key)) return true
    return scanned.words.some((word) => sameHealthFamily(word, key))
  })
}

/** Filtre local uniquement (sans IA). Préférer `evaluateDistress` côté UI. */
export function needsDistressScreen(
  answers: Record<string, unknown>,
  keywords: readonly string[] = DISTRESS_KEYWORDS,
): boolean {
  return findDistressMatches(answers, keywords.length ? keywords : DISTRESS_KEYWORDS).length > 0
}

/** À appeler après le filtre détresse (prioritaire). */
export function needsHealthScreen(
  answers: Record<string, unknown>,
  keywords: readonly string[] = HEALTH_KEYWORDS,
): boolean {
  if (answers.health_ack === '1' || answers.health_ack === true) return false
  return answersMatchKeywords(answers, keywords.length ? keywords : HEALTH_KEYWORDS)
}
