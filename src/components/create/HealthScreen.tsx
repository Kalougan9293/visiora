import { useState } from 'react'
import { cn } from '@/lib/utils'
import { HEALTH_COPY } from '@/services/healthGate'

export function HealthScreen({
  isAqua,
  onAccept,
}: {
  isAqua?: boolean
  onAccept: () => void
}) {
  const [checked, setChecked] = useState(false)

  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-lg flex-col items-center px-1 text-center',
        isAqua ? 'text-[#e8f7f9]' : 'text-ink dark:text-cream',
      )}
    >
      <h1
        className={cn(
          'text-[1.45rem] leading-snug sm:text-2xl',
          isAqua ? 'text-[#e8f7f9]' : 'font-display text-ink dark:text-cream',
        )}
        style={isAqua ? { fontFamily: 'var(--font-aqua-display)' } : undefined}
      >
        {HEALTH_COPY.title}
      </h1>
      <p
        className={cn(
          'mt-4 max-w-md text-left text-sm leading-relaxed',
          isAqua ? 'text-[#b8e4ea]/90' : 'text-ink/72 dark:text-champagne/88',
        )}
      >
        {HEALTH_COPY.body}
      </p>

      <label
        className={cn(
          'mt-6 flex w-full max-w-md cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-left text-sm',
          isAqua
            ? 'border-white/15 bg-white/[0.06] text-[#e8f7f9]/95'
            : 'border-black/10 bg-black/[0.03] text-ink/85 dark:border-[var(--vs-ardoise)] dark:bg-white/[0.04] dark:text-[var(--vs-lunaire)]',
        )}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#7ed4df]"
        />
        <span>{HEALTH_COPY.checkbox}</span>
      </label>

      <button
        type="button"
        disabled={!checked}
        onClick={onAccept}
        className={cn(
          'mt-5 w-full max-w-xs rounded-full py-2.5 text-sm font-semibold transition-opacity disabled:opacity-40',
          isAqua
            ? 'bg-[#e8f7f9] text-[#0d3d47]'
            : 'bg-olive text-cream dark:bg-[var(--vs-or)] dark:text-[var(--vs-nuit)]',
        )}
      >
        Continuer
      </button>
    </div>
  )
}
