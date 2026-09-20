/** Contenu exact du questionnaire MVP Visiora — ne pas altérer le texte */

export const CREATE_INTRO = {
  title: 'Concepteur de visualisations',
  body: "Notre questionnaire scientifique va cartographier vos aspirations, vos forces actives, vos freins conscients et votre canal sensoriel dominant afin d'engendrer un script d'imagerie sur mesure de 15 minutes.",
  detailsLabel: "DÉTAILS DE L'AVENTURE :",
  details: [
    '13 questions précises et structurantes.',
    'Adaptation subliminale de votre vocabulaire sensoriel.',
    "Génération de voix naturelle et mixage d'ondes binaurales.",
  ],
  cta: 'Commencer le questionnaire',
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
    subtitle: 'Établissons ensemble le socle de ta séance de visualisation.',
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
    subtitle: 'Le cerveau traite les images vécues et imaginées de la même manière.',
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
    subtitle: 'Choisissons la texture vocale et littéraire de ton voyage.',
    fields: [
      {
        id: 'q12_tutoiement',
        label: 'Formulation',
        type: 'choice-row',
        choices: [
          { id: 'tu', label: 'Tutoiement' },
          { id: 'vous', label: 'Vouvoiement' },
        ],
      },
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

/** Voix Aqua : portraits carrés (sans noms) — placer les images dans /public/voices/ */
export const AQUA_VOICES = [
  {
    id: 'rituel',
    photo: '/voices/yoga.jpg',
    label: 'Vanessa',
    vibe: '',
    objectPosition: '50% 12%',
    ambiance: 'oiseaux' as const,
    preview: '/voices/rituel-preview.mp3?v=v3',
  },
  {
    id: 'antoni',
    photo: '/voices/damien.jpg',
    label: 'Damien',
    vibe: '',
    objectPosition: '50% 12%',
    ambiance: null,
    preview: '/voices/damien-preview.mp3?v=d1',
  },
  {
    id: 'onde',
    photo: '/voices/sabrina.jpg',
    label: 'Sabrina',
    vibe: '',
    objectPosition: '50% 18%',
    ambiance: 'eau' as const,
    preview: '/voices/onde-preview.mp3?v=natural1',
  },
] as const

/** Placeholders Aqua uniquement — n’altère pas la version client. */
export const AQUA_FIELD_PLACEHOLDERS: Record<string, string> = {
  q1: 'Ex : Défi sportif, entretien, stress…',
  q2: 'Ex : Une date précise — ou « aucune » si tu n’as pas d’échéance',
  q3: 'Ex : Pour me sentir à ma place, avancer sans me freiner…',
  q4: 'Ex : Je vois des visages apaisés, j’entends mon souffle, je sens mon corps stable…',
  q5: 'Ex : Une paix profonde, une fierté calme, une confiance tranquille…',
  q6: 'Ex : Tendu, impatient, déjà un peu plus léger…',
  q7: 'Ex : La peur de ne pas être à la hauteur — je voudrais la voir comme un signal d’apprentissage…',
  q8: 'Ex : Gorge nouée, ventre serré, épaules crispées… (tu peux laisser vide)',
  q9: 'Ex : Je prépare, je m’entraîne, j’en parle à quelqu’un de confiance…',
  q10: 'Ex : Envoyer un message, 5 minutes de pratique, trois respirations profondes…',
  q11: 'Ex : J’ai ma place. Je suis capable. Je peux y arriver.',
  q13: 'Ex : Ton prénom — ou laisse vide',
}
