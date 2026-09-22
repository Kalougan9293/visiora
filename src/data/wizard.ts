/** Contenu exact du questionnaire MVP Visiora — ne pas altérer le texte */

export const CREATE_INTRO = {
  title: 'Ta séance sur mesure',
  body: "Quelques questions pour cerner ton objectif, ce qui te freine et ce que tu veux ressentir. À partir de tes réponses, Visiora écrit une séance de quinze minutes qui n'existera que pour toi.",
  detailsLabel: 'CE QUI T’ATTEND',
  details: [
    '13 questions, une dizaine de minutes.',
    'Un texte écrit à partir de tes mots, adapté à ta façon de ressentir.',
    'Une voix naturelle et une ambiance sonore, prêtes à écouter.',
  ],
  cta: 'Commencer',
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
    title: 'Définis ton objectif précis',
    subtitle: 'On pose ensemble le socle de ta séance de visualisation.',
    fields: [
      {
        id: 'q1',
        label: 'Quel objectif précis veux-tu atteindre ?',
        placeholder: "Ex: Passer mon entretien d'embauche avec calme...",
        type: 'text',
      },
      {
        id: 'q2',
        label: 'Pour quand ? Date ou échéance ?',
        placeholder: 'Ex: Le 15 septembre, dans 2 mois...',
        type: 'text',
      },
      {
        id: 'q3',
        label: 'Pourquoi est-ce important pour toi, maintenant ?',
        placeholder: 'Ex: Pour lancer ma carrière, me sentir à ma place...',
        type: 'textarea',
      },
    ],
  },
  {
    step: 2,
    total: 5,
    percent: 40,
    title: 'Imagine ta réussite',
    subtitle: 'Décris la scène comme si tu y étais. Ton cerveau s’entraîne, même sans mouvement.',
    fields: [
      {
        id: 'q4',
        label: 'Décris la scène de réussite comme si tu y étais :',
        placeholder:
          "Que vois-tu autour de toi ? Qu'entends-tu ? Que ressens-tu physiquement dans ton corps ? (Ex: je vois des visages souriants, j'entends des applaudissements chaleureux, mon cœur bat sereinement...)",
        type: 'textarea',
        hint: 'Astuce : Utilise des mots sensoriels ("je vois", "j\'entends", "je sens") pour affiner l\'analyse de l\'IA.',
      },
      {
        id: 'q5',
        label: 'Quelle émotion veux-tu ressentir le plus fort à la fin ?',
        placeholder: "Ex: Une paix profonde, une fierté immense, l'invincibilité...",
        type: 'text',
      },
    ],
  },
  {
    step: 3,
    total: 5,
    percent: 60,
    title: 'Traverser les obstacles',
    subtitle: "Regarder l'obstacle à distance pour mieux le transformer.",
    fields: [
      {
        id: 'q6',
        label: "Comment te sens-tu à ce sujet aujourd'hui ?",
        placeholder: 'Ex: Anxieux, impatient, hésitant...',
        type: 'text',
      },
      {
        id: 'q7',
        label:
          "Qu'est-ce qui se met le plus en travers, et comment aimerais-tu le voir autrement ?",
        placeholder:
          "Ex: Le syndrome de l'imposteur. J'aimerais le voir comme un signal que j'apprends de nouvelles choses...",
        type: 'textarea',
      },
      {
        id: 'q8',
        label: 'Une sensation physique liée à cette peur ? (optionnel)',
        placeholder: 'Ex: Gorge nouée, cheville fragile, estomac lourd...',
        type: 'text',
        optional: true,
      },
    ],
  },
  {
    step: 4,
    total: 5,
    percent: 80,
    title: "Ancrage et Passage à l'acte",
    subtitle: 'Relier la visualisation à la réalité concrète.',
    fields: [
      {
        id: 'q9',
        label: "Qu'est-ce que tu mets déjà en place pour y arriver ?",
        placeholder: "Ex: Je révise mes dossiers, je m'entraîne à voix haute devant un miroir...",
        type: 'textarea',
      },
      {
        id: 'q10',
        label: "Une micro-action concrète faisable dès aujourd'hui ou demain ?",
        placeholder: 'Ex: Envoyer un mail, relire une fiche, faire 3 respirations...',
        type: 'textarea',
      },
      {
        id: 'q11',
        label: 'Quelle nouvelle vérité profonde veux-tu croire sur toi ?',
        placeholder: "Ex: J'ai pleinement ma place parmi ces professionnels...",
        type: 'text',
      },
    ],
  },
  {
    step: 5,
    total: 5,
    percent: 100,
    title: 'Paramètres audio de la séance',
    subtitle: 'Choisis la texture vocale et littéraire de ta séance.',
    fields: [
      {
        id: 'q12_registre',
        label: 'Registre',
        type: 'choice-row',
        choices: [
          { id: 'neutre', label: 'Neutre' },
          { id: 'spirituel', label: 'Spirituel' },
          { id: 'metaphysique', label: 'Métaphysique' },
        ],
      },
      {
        id: 'q13',
        label: 'Prénom à entendre (optionnel)',
        placeholder: 'Ex: Marie, Julien...',
        type: 'text',
        optional: true,
      },
      {
        id: 'duration_minutes',
        label: 'Durée de la séance',
        type: 'choice-row',
        choices: [
          { id: '15', label: '15 min' },
          { id: '10', label: '10 min' },
          { id: '3', label: '3 min' },
        ],
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
    id: 'rituel',
    name: 'Vanessa',
    description: '',
    gender: 'Féminin',
    tag: '10/10',
    ambiance: 'oiseaux',
    preview: '/voices/rituel-preview.mp3?v=v3',
  },
  {
    id: 'antoni',
    name: 'Damien',
    description: '',
    gender: 'Masculin',
    tag: '8/10',
    ambiance: null,
    preview: '/voices/damien-preview.mp3?v=d1',
  },
  {
    id: 'onde',
    name: 'Sabrina',
    description: '',
    gender: 'Féminin',
    tag: '8/10',
    ambiance: 'eau',
    preview: '/voices/onde-preview.mp3?v=natural1',
  },
] as const

export const AMBIANCES = [
  { id: 'eau', label: 'Eau', description: 'Flux doux' },
  { id: 'oiseaux', label: 'Oiseaux', description: 'Nature légère' },
  { id: 'spa', label: 'Spa', description: 'Pad calme' },
] as const

