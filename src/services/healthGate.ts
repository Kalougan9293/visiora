/** Écran santé CDC (p.9) — déclenché par mots-clés dans Q1 / Q7 / Q8 / Q11. */

/** Un mot suffit : accents, espaces et tirets sont ignorés à la détection. */
export const HEALTH_KEYWORDS = [
  'santé',
  'maladie',
  'guérir',
  'guérison',
  'rémission',
  'douleur',
  'symptôme',
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
  'hôpital',
  'médecin',
  'migraine',
  'insomnie',
  'diabète',
  'hypertension',
  'asthme',
  'fibromyalgie',
  'arthrose',
  'lombalgie',
  'sciatique',
  'endométriose',
  'tumeur',
  'inflammation',
  'blessure',
  'chirurgie',
  'opération',
  'covid',
  'AVC',
  'infarctus',
  'anorexie',
  'boulimie',
  'bipolarité',
  'TOC',
  'addiction',
  'hernie',
  'tendinite',
  'eczéma',
  'psoriasis',
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

const SCAN_FIELDS = ['q1', 'q7', 'q8', 'q11'] as const

export const HEALTH_COPY = {
  title: "Avant d'entrer dans ta visualisation",
  body: "Ta séance touche à la santé et au mieux-être — un territoire précieux et intime. Prends un instant pour lire ceci. Visiora est un outil de bien-être et de développement personnel. Il ne remplace ni un avis médical, ni un suivi psychologique. Les images que tu vas explorer sont celles de ton imaginaire. Continue à prendre soin de toi et à t'entourer des personnes qui t'accompagnent.",
  checkbox: "J'ai lu et compris. Je suis prêt·e à vivre mon expérience.",
} as const

export function needsHealthScreen(
  answers: Record<string, unknown>,
  keywords: readonly string[] = HEALTH_KEYWORDS,
): boolean {
  if (answers.health_ack === '1' || answers.health_ack === true) return false
  const blob = SCAN_FIELDS.map((id) => {
    const v = answers[id]
    return typeof v === 'string' ? v : ''
  }).join(' ')
  if (!blob.trim()) return false
  const hay = healthMatchKey(blob)
  const list = keywords.length ? keywords : HEALTH_KEYWORDS
  return list.some((kw) => {
    const key = healthMatchKey(kw)
    return Boolean(key) && hay.includes(key)
  })
}
