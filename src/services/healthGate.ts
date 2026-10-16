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

const SCAN_FIELDS = ['q1', 'q7', 'q11'] as const

export const HEALTH_COPY = {
  title: "Avant d'entrer dans ta visualisation",
  body: "Ta séance touche à la santé et au mieux-être — un territoire précieux et intime. Prends un instant pour lire ceci. VisuaRise est un outil de bien-être et de développement personnel. Il ne remplace ni un avis médical, ni un suivi psychologique. Les images que tu vas explorer sont celles de ton imaginaire. Continue à prendre soin de toi et à t'entourer des personnes qui t'accompagnent.",
  checkbox:
    "J'accepte que les informations de santé que j'ai partagées servent uniquement à créer et conserver ma séance.",
} as const

/** Détresse : arrêt net, pas de séance. */
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
] as const

export const DISTRESS_COPY = {
  title: 'On s’arrête ici',
  lead: 'Ce que tu traverses semble très difficile. VisuaRise ne peut pas t’accompagner dans ce moment.',
  line3114: 'Tu peux appeler le 3114, gratuitement, jour et nuit, pour parler à un professionnel.',
  lineUrgence: 'En cas d’urgence, appelle le 15 ou le 112.',
  back: 'Revenir au questionnaire',
} as const

/** Le passage par l’écran n’est pas une donnée à conserver. */
export function answersForStorage<T extends Record<string, unknown>>(answers: T): T {
  const next = { ...answers }
  delete next.health_ack
  delete next.health_ack_at
  return next
}

function scanBlob(answers: Record<string, unknown>): { hay: string; words: string[] } | null {
  const blob = SCAN_FIELDS.map((id) => {
    const v = answers[id]
    return typeof v === 'string' ? v : ''
  }).join(' ')
  if (!blob.trim()) return null
  return { hay: healthMatchKey(blob), words: healthWords(blob) }
}

export function answersMatchKeywords(
  answers: Record<string, unknown>,
  keywords: readonly string[],
): boolean {
  const scanned = scanBlob(answers)
  if (!scanned) return false
  const list = keywords.length ? keywords : []
  return list.some((kw) => {
    const key = healthMatchKey(kw)
    if (!key) return false
    if (scanned.hay.includes(key)) return true
    return scanned.words.some((word) => sameHealthFamily(word, key))
  })
}

export function needsDistressScreen(
  answers: Record<string, unknown>,
  keywords: readonly string[] = DISTRESS_KEYWORDS,
): boolean {
  return answersMatchKeywords(answers, keywords.length ? keywords : DISTRESS_KEYWORDS)
}

/** À appeler après le filtre détresse (prioritaire). */
export function needsHealthScreen(
  answers: Record<string, unknown>,
  keywords: readonly string[] = HEALTH_KEYWORDS,
): boolean {
  if (answers.health_ack === '1' || answers.health_ack === true) return false
  return answersMatchKeywords(answers, keywords.length ? keywords : HEALTH_KEYWORDS)
}
