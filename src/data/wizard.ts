/** Questionnaire VisuaRise — textes validés 31/10/2026 */

export const CREATE_INTRO = {
  title: 'Ta séance sur mesure',
  body: 'Prends un moment pour toi. Quelques questions pour explorer ce que tu désires vraiment, ce qui te retient et ce que tu as envie de ressentir. À partir de tes mots, VisuaRise crée une séance de quinze minutes, unique, pensée pour toi seulement.',
  detailsLabel: 'CE QUI T’ATTEND',
  details: [
    'Une dizaine de minutes pour te poser et répondre.',
    'Une séance audio de quinze minutes, écrite à partir de tes propres mots.',
    'Une voix douce et une musique apaisante pour t’accompagner, à réécouter quand tu veux.',
  ],
  cta: 'Commencer',
} as const

export const CREATE_PREP = {
  title: 'Avant de commencer',
  body: 'Offre-toi un moment au calme. Installe-toi confortablement, respire profondément trois fois, et laisse venir ce que tu aimerais vraiment vivre.',
  aside:
    'Il n’y a pas de bonne ou de mauvaise réponse. Écris avec tes mots, comme ils viennent : plus tu es sincère et précis, plus ta séance te ressemblera.',
  cta: 'Je suis prêt·e, je commence',
} as const

export type FieldType = 'text' | 'textarea' | 'voice' | 'choice-row'

export interface WizardField {
  id: string
  label: string
  placeholder?: string
  type: FieldType
  optional?: boolean
  hint?: string
  badge?: string
  /** Pour choice-row simples (tutoiement, registre) */
  choices?: { id: string; label: string }[]
}

export interface WizardStep {
  step: number
  total: number
  percent: number
  title: string
  subtitle: string
  fields: WizardField[]
}

export const WIZARD_STEPS: WizardStep[] = [
  {
    step: 1,
    total: 5,
    percent: 20,
    title: 'Ton objectif',
    subtitle: 'Commençons par ce qui compte vraiment pour toi.',
    fields: [
      {
        id: 'q1',
        label: 'Qu’aimerais-tu réussir, vivre ou devenir ?',
        placeholder: 'Ex. : passer mon entretien avec calme…',
        type: 'text',
        hint: 'Sois précis : plus ton objectif est clair, plus ta séance sera juste.',
      },
      {
        id: 'q2',
        label: 'Pour quand ?',
        placeholder: 'Ex. : le 15 septembre, dans deux mois…',
        type: 'text',
        hint: 'Une date, ou simplement un horizon.',
      },
      {
        id: 'q3',
        label: 'Pourquoi est-ce important pour toi, aujourd’hui ?',
        placeholder: 'Ex. : pour lancer ma carrière, me sentir à ma place…',
        type: 'textarea',
      },
    ],
  },
  {
    step: 2,
    total: 5,
    percent: 40,
    title: 'Imagine ta réussite',
    subtitle: 'Projette-toi : c’est cette scène que tu vas vivre pendant ta séance.',
    fields: [
      {
        id: 'q4',
        label: 'Imagine que c’est fait. Où es-tu ? Que vois-tu, qu’entends-tu, que ressens-tu ?',
        placeholder: 'Décris la scène avec tes mots, le plus précisément possible.',
        type: 'textarea',
      },
      {
        id: 'q5',
        label: 'Dans cette scène, quelle émotion aimerais-tu ressentir le plus fort ?',
        placeholder: 'Ex. : une paix profonde, une fierté immense…',
        type: 'text',
      },
    ],
  },
  {
    step: 3,
    total: 5,
    percent: 60,
    title: 'Ce qui te freine',
    subtitle: 'Tout chemin a ses obstacles. Les nommer, c’est déjà commencer à les traverser.',
    fields: [
      {
        id: 'q6',
        label: 'Quand tu penses à cet objectif aujourd’hui, comment te sens-tu ?',
        placeholder: 'Ex. : de l’élan, du doute, de l’impatience…',
        type: 'text',
        hint: 'Par exemple : de l’élan, du doute, de l’impatience…',
      },
      {
        id: 'q7a',
        label: 'Qu’est-ce qui te freine le plus ?',
        placeholder: 'Ex. : le syndrome de l’imposteur, la peur du jugement…',
        type: 'textarea',
      },
      {
        id: 'q7b',
        label: 'Et si tu pouvais le voir autrement, que te dirais-tu ?',
        placeholder: 'Ex. : c’est un signal que j’apprends de nouvelles choses…',
        type: 'textarea',
      },
      {
        id: 'q8',
        label: 'Où ressens-tu ce frein dans ton corps ? (facultatif)',
        placeholder: 'Ex. : un nœud dans le ventre, des épaules tendues…',
        type: 'text',
        optional: true,
        hint: 'Par exemple : un nœud dans le ventre, des épaules tendues…',
      },
    ],
  },
  {
    step: 4,
    total: 5,
    percent: 80,
    title: 'Ton premier pas',
    subtitle: 'Une visualisation prend toute sa force quand elle te met en mouvement.',
    fields: [
      {
        id: 'q9',
        label: 'Qu’est-ce que tu fais déjà pour y arriver ?',
        placeholder: 'Ex. : je révise mes dossiers, je m’entraîne à voix haute…',
        type: 'textarea',
        hint: 'Même un petit pas compte.',
      },
      {
        id: 'q10',
        label: 'Quelle est la toute prochaine petite action que tu peux faire aujourd’hui ou demain ?',
        placeholder: 'Ex. : envoyer un mail, relire une fiche, faire 3 respirations…',
        type: 'textarea',
        hint: 'Choisis-en une seule : c’est elle que ta séance va ancrer.',
      },
      {
        id: 'q11',
        label: 'Quelle phrase aimerais-tu croire profondément sur toi ?',
        placeholder: 'Ex. : « J’ai ma place »',
        type: 'textarea',
        hint: 'Écris-la comme si elle était déjà vraie, par exemple : « J’ai ma place ».',
      },
    ],
  },
  {
    step: 5,
    total: 5,
    percent: 100,
    title: 'Ta séance',
    subtitle: 'Choisis la voix et l’ambiance qui vont t’accompagner.',
    fields: [
      {
        id: 'q12_registre',
        label: 'Registre',
        type: 'choice-row',
        choices: [
          { id: 'neutre', label: 'Neutre' },
          { id: 'spirituel', label: 'Spirituel' },
        ],
      },
      {
        id: 'q13',
        label: 'Prénom à entendre (optionnel)',
        placeholder: 'Ex. : Marie, Julien…',
        type: 'text',
        optional: true,
      },
      {
        id: 'q12_voice',
        label: 'Voix',
        type: 'voice',
      },
    ],
  },
]

export const VOICES = [
  {
    id: 'aurore',
    name: 'Aurore',
    /** Fond déjà mixé dans le MP3 d’extrait. `dry` = la même phrase, sans fond. */
    preview: '/voices/aurore-preview.mp3?v=bed8',
    dry: '/voices/aurore-dry.mp3',
  },
  {
    id: 'steve',
    name: 'Steve',
    preview: '/voices/steve-preview.mp3?v=bed1',
    dry: '/voices/steve-dry.mp3',
  },
] as const

const ADDED_VOICE = /^v\d{10,16}$/

export function catalogVoiceId(id: string | null | undefined): string {
  const key = (id ?? '').trim().toLowerCase()
  if (ADDED_VOICE.test(key) || VOICES.some((voice) => voice.id === key)) return key
  return 'aurore'
}

export function voiceLabel(id: string | null | undefined): string {
  if (!id) return '—'
  const key = id.toLowerCase()
  return VOICES.find((voice) => voice.id === key)?.name ?? id
}

/** Assemble Q7a/Q7b (ou l’ancien champ unique q7) pour le script. */
export function combineObstacleAnswers(answers: Record<string, unknown>): string {
  const a = typeof answers.q7a === 'string' ? answers.q7a.trim() : ''
  const b = typeof answers.q7b === 'string' ? answers.q7b.trim() : ''
  if (a && b) return `${a} — ${b}`
  if (a || b) return a || b
  const legacy = typeof answers.q7 === 'string' ? answers.q7.trim() : ''
  return legacy
}
