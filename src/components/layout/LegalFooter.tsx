import { Link } from 'react-router-dom'
import { APP_COPY } from '@/data/uiCopy'
import { LEGAL_DOCUMENTS } from '@/data/legal'
import { cn } from '@/lib/utils'

export function LegalFooter({ className }: { className?: string }) {
  return (
    <footer className={cn('w-full pt-8 text-center', className)}>
      <p className="mx-auto max-w-sm text-[11px] leading-relaxed text-ink/55 dark:text-[var(--vs-texte-faible)]">
        {APP_COPY.footerLegal}
      </p>
      <nav className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px]">
        {LEGAL_DOCUMENTS.map((doc) => (
          <Link
            key={doc.slug}
            to={`/legal/${doc.slug}`}
            className="text-ink/70 underline decoration-black/25 underline-offset-4 dark:text-champagne/80 dark:decoration-white/25"
          >
            {doc.slug === 'cgu' ? 'CGU' : doc.slug === 'confidentialite' ? 'Confidentialité' : 'Mentions légales'}
          </Link>
        ))}
      </nav>
      <p className="mt-2 text-[10px] tracking-wide text-ink/40 dark:text-[var(--vs-texte-faible)]">
        {APP_COPY.footerCredit}
      </p>
    </footer>
  )
}
