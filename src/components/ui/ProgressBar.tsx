import { cn } from '@/lib/utils'

interface ProgressBarProps {
  value: number
  max?: number
  className?: string
  label?: string
}

export function ProgressBar({ value, max = 100, className, label }: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <p className="mb-2 text-xs tracking-wide text-ink/70 dark:text-champagne/82">
          {label} · {Math.round(pct)}%
        </p>
      )}
      <div className="h-1.5 overflow-hidden rounded-full bg-black/8 dark:bg-white/8">
        <div
          className="h-full rounded-full bg-gradient-to-r from-olive via-gold to-gold-bright transition-[width] duration-500 ease-[var(--ease-out-expo)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
