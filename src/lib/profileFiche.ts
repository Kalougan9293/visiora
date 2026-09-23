/** Même fiche que l’Edge Function — message utilisateur uniquement. */

const Q_LABELS: { key: string; label: string; optional?: boolean }[] = [
  { key: 'q1', label: 'Q1  Objectif précis' },
  { key: 'q2', label: 'Q2  Échéance' },
  { key: 'q3', label: 'Q3  Pourquoi c\'est important maintenant' },
  { key: 'q4', label: 'Q4  Scène de réussite' },
  { key: 'q5', label: 'Q5  Émotion cible' },
  { key: 'q6', label: 'Q6  État actuel' },
  { key: 'q7', label: 'Q7  Obstacle + recadrage souhaité' },
  { key: 'q8', label: 'Q8  Blocage physique', optional: true },
  { key: 'q9', label: 'Q9  Ce que l\'utilisateur met déjà en place' },
  { key: 'q10', label: 'Q10 Micro-action concrète' },
  { key: 'q11', label: 'Q11 Croyance cible' },
  { key: 'q13', label: 'Q13 Prénom', optional: true },
]

function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean).join(', ')
  return ''
}

function q12Line(answers: Record<string, unknown>): string {
  const registre = asText(answers.q12_registre)
  const voice = asText(answers.q12_voice)
  const tu = 'tutoiement'
  const reg =
    registre === 'spirituel'
      ? 'spirituel ouvert'
      : registre === 'metaphysique'
        ? 'entre les deux'
        : 'laïc'
  const parts = [`formulation : ${tu}`, `registre : ${reg}`]
  if (voice) parts.unshift(`voix : ${voice}`)
  return `Q12 ${parts.join(' · ')}`
}

export function formatProfileFiche(answers: Record<string, unknown> | null | undefined): string {
  const src = answers && typeof answers === 'object' ? answers : {}
  const lines: string[] = ['Fiche profil utilisateur :', '']
  for (const row of Q_LABELS) {
    const value = asText(src[row.key])
    if (!value) continue
    lines.push(`${row.label} : ${value}`)
  }
  lines.push(q12Line(src))
  const durationRaw = Number(src.duration_minutes)
  const duration = durationRaw === 3 || durationRaw === 10 || durationRaw === 15 ? durationRaw : 15
  const words = duration === 3 ? 320 : duration === 10 ? 850 : 1200
  lines.push(`Durée cible : ${duration} minutes, environ ${words} mots.`)
  lines.push('')
  lines.push('Génère le script de séance pour ce profil.')
  return lines.join('\n')
}
