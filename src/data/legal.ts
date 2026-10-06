/**
 * publishedOn : date ISO du jour où le texte est collé ici.
 * Tant qu’elle est vide, la page ne l’affiche pas.
 */
export type LegalSlug = 'cgu' | 'confidentialite' | 'mentions-legales'

export type LegalDocument = {
  slug: LegalSlug
  title: string
  publishedOn: string | null
  paragraphs: string[]
}

export const LEGAL_DOCUMENTS: LegalDocument[] = [
  {
    slug: 'cgu',
    title: 'Conditions générales d’utilisation',
    publishedOn: null,
    paragraphs: [],
  },
  {
    slug: 'confidentialite',
    title: 'Politique de confidentialité',
    publishedOn: null,
    paragraphs: [],
  },
  {
    slug: 'mentions-legales',
    title: 'Mentions légales',
    publishedOn: null,
    paragraphs: [],
  },
]

export function legalDocument(slug: string): LegalDocument | undefined {
  return LEGAL_DOCUMENTS.find((doc) => doc.slug === slug)
}

export function legalPublishedLabel(iso: string): string {
  const date = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}
