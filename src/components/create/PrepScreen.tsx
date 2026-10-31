import { useEffect, useState, type CSSProperties } from 'react'
import { CREATE_PREP } from '@/data/wizard'
import { APP_COPY } from '@/data/uiCopy'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

const BREATH_CYCLE_MS = 10_000

/** Écran calme entre l’intro et le questionnaire — même onde que la génération. */
export function PrepScreen({
  onContinue,
  onBack,
}: {
  onContinue: () => void
  onBack: () => void
}) {
  const [phase, setPhase] = useState<'in' | 'out'>('in')
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setReduceMotion(reduce)
    if (reduce) return
    let cancelled = false
    let timeoutId = 0
    const tick = (next: 'in' | 'out') => {
      if (cancelled) return
      setPhase(next)
      timeoutId = window.setTimeout(() => tick(next === 'in' ? 'out' : 'in'), next === 'in' ? 4000 : 6000)
    }
    tick('in')
    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [])

  const cue = reduceMotion ? APP_COPY.breathStill : phase === 'in' ? APP_COPY.breathIn : APP_COPY.breathOut

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-xl flex-1 flex-col items-center text-center">
      <div className="flex min-h-0 w-full flex-1 flex-col justify-center overflow-y-auto py-2">
        <h1 className="font-display text-[1.7rem] leading-snug tracking-tight text-ink dark:text-cream sm:text-[1.95rem]">
          {CREATE_PREP.title}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-ink/75 dark:text-cream/85">
          {CREATE_PREP.body}
        </p>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-ink/60 dark:text-cream/70">
          {CREATE_PREP.aside}
        </p>

        <div
          className={cn(
            'relative mx-auto mt-8 w-full max-w-sm overflow-hidden rounded-2xl',
            'border border-[var(--vs-bordure)]',
            'bg-[color-mix(in_srgb,var(--vs-lunaire)_92%,var(--vs-azur))]',
            'dark:bg-[color-mix(in_srgb,var(--vs-nuit)_88%,var(--vs-abysse))]',
            'min-h-[14rem]',
          )}
          aria-hidden
        >
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className={cn(
                'vs-breath-orb relative flex h-[9.5rem] w-[9.5rem] items-center justify-center',
                !reduceMotion && 'vs-breath-orb-live',
              )}
              style={
                reduceMotion
                  ? undefined
                  : ({ '--vs-breath-ms': `${BREATH_CYCLE_MS}ms` } as CSSProperties)
              }
            >
              <span className="vs-breath-ring absolute inset-0 rounded-full border border-[color-mix(in_srgb,var(--vs-azur)_28%,transparent)]" />
              <span className="vs-breath-ring absolute inset-[12%] rounded-full border border-[color-mix(in_srgb,var(--vs-azur)_20%,transparent)]" />
              <span className="absolute inset-[22%] rounded-full bg-[radial-gradient(circle_at_50%_40%,color-mix(in_srgb,var(--vs-ecume)_55%,var(--vs-azur)),color-mix(in_srgb,var(--vs-azur)_55%,transparent)_62%,transparent_78%)] opacity-90" />
            </div>
          </div>
          <div className="relative z-10 flex min-h-[14rem] flex-col items-center justify-center px-4">
            <p
              key={cue}
              className={cn(
                'font-display text-[1.6rem] text-[var(--vs-nuit)] dark:text-[var(--vs-ecume)]',
                !reduceMotion && 'vs-breath-cue',
              )}
            >
              {cue}
            </p>
          </div>
        </div>
      </div>

      <div className="flex w-full shrink-0 flex-col gap-2.5 pt-3 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
        <Button className="w-full rounded-full !py-3 text-base" onClick={onContinue}>
          {CREATE_PREP.cta}
        </Button>
        <button
          type="button"
          onClick={onBack}
          className="py-2 text-[15px] text-ink/55 transition hover:text-ink dark:text-cream/55 dark:hover:text-cream"
        >
          Retour
        </button>
      </div>
    </div>
  )
}
