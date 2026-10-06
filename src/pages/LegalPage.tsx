import { Link, Navigate, useParams } from 'react-router-dom'
import { LegalFooter } from '@/components/layout/LegalFooter'
import { legalDocument, legalPublishedLabel } from '@/data/legal'

export function LegalPage() {
  const { slug } = useParams()
  const doc = legalDocument(slug ?? '')
  if (!doc) return <Navigate to="/" replace />
  const published = doc.publishedOn ? legalPublishedLabel(doc.publishedOn) : ''

  return (
    <article className="mx-auto flex w-full max-w-lg flex-col pb-6">
      <Link
        to="/"
        className="text-[12px] text-ink/55 underline decoration-black/20 underline-offset-4 dark:text-[var(--vs-texte-faible)] dark:decoration-white/20"
      >
        Retour
      </Link>
      <h1 className="mt-6 text-center font-display text-[1.85rem] leading-tight tracking-tight text-ink dark:text-cream sm:text-4xl">
        {doc.title}
      </h1>
      <div className="mx-auto mt-4 h-px w-16 bg-[var(--vs-or)]/70" />
      {published && (
        <p className="mt-4 text-center text-[12px] tracking-wide text-ink/55 dark:text-[var(--vs-texte-faible)]">
          Mis en ligne le {published}
        </p>
      )}
      {doc.paragraphs.length > 0 ? (
        <div className="mt-8 space-y-4 text-justify text-[15px] leading-relaxed text-ink/85 hyphens-auto dark:text-champagne/90">
          {doc.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      ) : (
        <p className="mt-8 text-center text-sm leading-relaxed text-ink/60 dark:text-champagne/75">
          Le texte sera publié ici.
        </p>
      )}
      <LegalFooter />
    </article>
  )
}
