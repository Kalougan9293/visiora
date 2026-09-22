import { APP_COPY } from '@/data/uiCopy'
import { cn } from '@/lib/utils'

export function LegalFooter({ className }: { className?: string }) {
  return (
    <footer className={cn('w-full pt-8 text-center', className)}>
      <p className="mx-auto max-w-sm text-[11px] leading-relaxed text-ink/55 dark:text-[var(--vs-texte-faible)]">
        {APP_COPY.footerLegal}
      </p>
      <p className="mt-2 text-[10px] tracking-wide text-ink/40 dark:text-[var(--vs-texte-faible)]">
        {APP_COPY.footerCredit}
      </p>
    </footer>
  )
}
