/** Écran santé CDC (p.9) — déclenché par mots-clés dans Q1 / Q7 / Q8 / Q11. */

/** Liste éditable sans redéploiement. */
export const HEALTH_KEYWORDS = [
  'santé',
  'sante',
  'maladie',
  'guérir',
  'guerir',
  'guérison',
  'guerison',
  'rémission',
  'remission',
  'douleur',
  'symptôme',
  'symptome',
  'diagnostic',
  'traitement',
  'cancer',
  'dépression',
  'depression',
  'anxiété',
  'anxiete',
  'burn-out',
  'burnout',
  'burn out',
  'pathologie',
  'thérapie',
  'therapie',
  'médicament',
  'medicament',
  'hôpital',
  'hopital',
  'médecin',
  'medecin',
] as const

const SCAN_FIELDS = ['q1', 'q7', 'q8', 'q11'] as const

export const HEALTH_COPY = {
  title: "Avant d'entrer dans ta visualisation",
  body: "Ta séance touche à la santé et au mieux-être — un territoire précieux et intime. Prends un instant pour lire ceci, en toute confiance. VISIORA t'invite à vivre une expérience intérieure puissante : ressentir, imaginer, et t'ouvrir à ton propre potentiel de mieux-être. C'est un espace de ton monde intérieur, où tu peux explorer librement. En même temps, par honnêteté envers toi : VISIORA est un outil de bien-être et de développement personnel. Il ne remplace pas l'avis ou le suivi d'un professionnel de santé, et ne garantit aucune guérison. Continue à prendre soin de toi et à t'entourer des personnes qui t'accompagnent. Les ressentis que tu vas explorer sont ceux de ton imaginaire, et c'est déjà, en soi, une belle source de force.",
  checkbox: "J'ai lu et compris. Je suis prêt·e à vivre mon expérience.",
} as const

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

export function needsHealthScreen(answers: Record<string, unknown>): boolean {
  if (answers.health_ack === '1' || answers.health_ack === true) return false
  const blob = SCAN_FIELDS.map((id) => {
    const v = answers[id]
    return typeof v === 'string' ? v : ''
  }).join(' ')
  if (!blob.trim()) return false
  const hay = normalize(blob)
  return HEALTH_KEYWORDS.some((kw) => hay.includes(normalize(kw)))
}
