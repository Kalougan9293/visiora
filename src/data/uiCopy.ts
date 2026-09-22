/** Textes officiels v1 — tutoiement partout, aucun mot banni. */

export const HOME_COPY = {
  badge: 'IMAGERIE MENTALE · IA',
  line1: 'Visualise.',
  line2: 'Ressens.',
  line3: 'Façonne ta réalité.',
  intro:
    'Crée en quelques minutes ta séance de visualisation guidée, écrite pour toi. Un objectif sportif, professionnel ou personnel — et une immersion de quinze minutes conçue à partir de tes réponses.',
  cta: 'Créer ma séance',
  section: 'LES FONDEMENTS DE LA MÉTHODE',
  swipe: 'Glisse pour explorer',
} as const

export const LIBRARY_COPY = {
  title: 'Ma bibliothèque',
  subtitle: 'Tes séances, conservées avec ton compte',
  emptyTitle: 'Ta bibliothèque est encore vide',
  emptyBody:
    'Ta première séance apparaîtra ici, et tu pourras la réécouter autant de fois que tu veux.',
  emptyCta: 'Créer ma première séance',
  lockedTitle: 'Connexion requise',
  lockedBody: 'Connecte-toi pour retrouver tes séances et en créer de nouvelles.',
  lockedCta: 'Se connecter',
} as const

export const PROGRESS_COPY = {
  title: 'Mon chemin',
  subtitle: 'Chaque écoute compte, à ton rythme',
  listens: 'Séances écoutées',
  practiceDays: 'Jours de pratique',
  nextLabel: 'PROCHAIN REPÈRE',
  nextBody: (remaining: number) =>
    `Plus que ${remaining} jour${remaining !== 1 ? 's' : ''} de pratique pour atteindre ce repère. Ils n'ont pas besoin de se suivre.`,
  journalTitle: 'Tes 14 derniers jours',
  whyTitle: 'Pourquoi revenir régulièrement ?',
  whyRepeat:
    "Une visualisation ne se joue pas en une fois. C'est la répétition qui installe une image mentale, comme pour n'importe quel apprentissage — et le sommeil qui la consolide.",
  whyDuration:
    "Maxwell Maltz estimait qu'il fallait au moins trois semaines pour qu'une nouvelle image de soi commence à s'installer. Les travaux plus récents sur les habitudes parlent plutôt de deux mois en moyenne, avec de grandes variations d'une personne à l'autre. Retiens surtout ceci : compte en semaines, pas en jours.",
  whyRegularity:
    "Dix minutes trois fois par semaine valent mieux qu'une heure une fois par mois. Et si tu sautes plusieurs jours, tu ne repars pas de zéro : tu reprends.",
  whyMoment:
    "Beaucoup de pratiques traditionnelles privilégient le réveil et le coucher, quand l'esprit est plus disponible. Essaie les deux et garde le moment qui te convient.",
  welcomeBack: "Content de te retrouver. On reprend là où tu en étais.",
} as const

export const APP_COPY = {
  trialBanner: "Version d'essai",
  generating:
    "Ta séance est en cours d'écriture. Tu peux fermer l'application, elle t'attendra dans ta bibliothèque.",
  generateError: "La génération n'a pas abouti. Tu peux relancer, rien n'est perdu.",
  deleteConfirm: 'Es-tu sûr ?',
  footerLegal:
    "Visiora est un outil de bien-être et de développement personnel. Il ne remplace ni un avis médical, ni un suivi psychologique.",
  footerCredit: '© 2026 Visiora — Jonathan Villette',
} as const
