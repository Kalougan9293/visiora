import { DISTRESS_COPY } from '@/services/healthGate'

export function DistressScreen({
  onBack,
  onApaisement,
  busy = false,
}: {
  onBack: () => void
  onApaisement: () => void
  busy?: boolean
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center px-1 text-center text-ink dark:text-cream">
      <h1 className="font-display text-[1.45rem] leading-snug text-ink dark:text-cream sm:text-2xl">
        {DISTRESS_COPY.title}
      </h1>
      <p className="mt-4 max-w-md text-justify text-sm leading-relaxed text-ink/72 dark:text-champagne/88">
        {DISTRESS_COPY.lead}
      </p>
      <p className="mt-4 max-w-md text-justify text-sm leading-relaxed text-ink/72 dark:text-champagne/88">
        Tu peux appeler le{' '}
        <a
          href="tel:3114"
          className="font-semibold text-[var(--vs-azur)] underline decoration-[var(--vs-azur)]/40 underline-offset-2"
        >
          3114
        </a>
        , gratuitement, jour et nuit, pour parler à quelqu’un de formé à l’écoute.
      </p>
      <p className="mt-3 max-w-md text-justify text-sm leading-relaxed text-ink/72 dark:text-champagne/88">
        En cas d’urgence, appelle le{' '}
        <a
          href="tel:15"
          className="font-semibold text-[var(--vs-azur)] underline decoration-[var(--vs-azur)]/40 underline-offset-2"
        >
          15
        </a>{' '}
        ou le{' '}
        <a
          href="tel:112"
          className="font-semibold text-[var(--vs-azur)] underline decoration-[var(--vs-azur)]/40 underline-offset-2"
        >
          112
        </a>
        .
      </p>
      <p className="mt-4 max-w-md text-justify text-sm leading-relaxed text-ink/72 dark:text-champagne/88">
        {DISTRESS_COPY.apaisementLead}
      </p>

      <button
        type="button"
        disabled={busy}
        onClick={onApaisement}
        className="mt-8 w-full max-w-xs rounded-full bg-[var(--vs-azur)] py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
      >
        {busy ? 'Création…' : DISTRESS_COPY.ctaApaisement}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onBack}
        className="mt-3 w-full max-w-xs rounded-full border border-[var(--vs-bordure)] bg-[var(--vs-surface)] py-2.5 text-sm font-semibold text-ink transition-opacity disabled:opacity-60 dark:text-[var(--vs-lunaire)]"
      >
        {DISTRESS_COPY.back}
      </button>
    </div>
  )
}
