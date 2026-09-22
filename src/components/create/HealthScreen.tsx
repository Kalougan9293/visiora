import { useState } from 'react'
import { cn } from '@/lib/utils'
import { HEALTH_COPY } from '@/services/healthGate'

export function HealthScreen({ onAccept }: { onAccept: () => void }) {
  const [checked, setChecked] = useState(false)

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center px-1 text-center text-ink dark:text-cream">
      <h1 className="font-display text-[1.45rem] leading-snug text-ink dark:text-cream sm:text-2xl">
        {HEALTH_COPY.title}
      </h1>
      <p className="mt-4 max-w-md text-justify text-sm leading-relaxed text-ink/72 dark:text-champagne/88">
        {HEALTH_COPY.body}
      </p>

      <label className="mt-6 flex w-full max-w-md cursor-pointer items-start gap-3 rounded-2xl border border-[var(--vs-bordure)] bg-[var(--vs-surface)] px-4 py-3 text-left text-sm text-ink/85 dark:text-[var(--vs-lunaire)]">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--vs-azur)]"
        />
        <span>{HEALTH_COPY.checkbox}</span>
      </label>

      <button
        type="button"
        disabled={!checked}
        onClick={onAccept}
        className="mt-5 w-full max-w-xs rounded-full bg-[var(--vs-or)] py-2.5 text-sm font-semibold text-[var(--vs-nuit)] transition-opacity disabled:opacity-40"
      >
        Continuer
      </button>
    </div>
  )
}
