import { useEffect, useState, type CSSProperties } from 'react'
import { APP_COPY } from '@/data/uiCopy'
import { cn } from '@/lib/utils'

/** Cycle complet : inspire 4 s, expire 6 s — calme, aligné sur le parasympathique. */
const BREATH_IN_MS = 4000
const BREATH_OUT_MS = 6000
const BREATH_CYCLE_MS = BREATH_IN_MS + BREATH_OUT_MS

/**
 * Attente de génération (7–9 min) transformée en préparation :
 * une onde qui respire, invitation à souffler avec elle.
 * Le % reste discret — la présence prime sur la barre.
 */
function floorKey(sessionId: string) {
  return `visiora-gen-floor:${sessionId}`
}

function readFloor(sessionId: string | undefined, server: number) {
  if (!sessionId) return server
  try {
    const raw = localStorage.getItem(floorKey(sessionId))
    const n = raw ? Number(raw) : NaN
    return Number.isFinite(n) ? Math.max(server, Math.round(n)) : server
  } catch {
    return server
  }
}

function writeFloor(sessionId: string | undefined, pct: number) {
  if (!sessionId) return
  try {
    localStorage.setItem(floorKey(sessionId), String(Math.round(pct)))
  } catch {
    /* ignore */
  }
}

export function GeneratingWaterProgress({
  serverPct,
  sessionId,
}: {
  serverPct: number
  sessionId?: string
}) {
  const server = Math.min(99, Math.max(5, Math.round(serverPct)))
  const [display, setDisplay] = useState(() => readFloor(sessionId, server))
  const [phase, setPhase] = useState<'in' | 'out'>('in')
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    setDisplay((prev) => {
      const next = Math.max(prev, server, readFloor(sessionId, server))
      writeFloor(sessionId, next)
      return next
    })
  }, [server, sessionId])

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setReduceMotion(reduce)
    if (reduce) {
      setDisplay(server)
      return
    }
    const timer = window.setInterval(() => {
      setDisplay((prev) => {
        const ceiling = Math.min(90, server + 6)
        if (prev < server) {
          return Math.min(server, prev + Math.max(0.5, (server - prev) * 0.18))
        }
        if (prev >= ceiling) return prev
        return Math.min(ceiling, prev + 0.4)
      })
    }, 1100)
    return () => window.clearInterval(timer)
  }, [server])

  useEffect(() => {
    if (reduceMotion) return
    let cancelled = false
    let timeoutId = 0
    const tick = (next: 'in' | 'out') => {
      if (cancelled) return
      setPhase(next)
      const wait = next === 'in' ? BREATH_IN_MS : BREATH_OUT_MS
      timeoutId = window.setTimeout(() => tick(next === 'in' ? 'out' : 'in'), wait)
    }
    tick('in')
    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [reduceMotion])

  const shown = Math.min(99, Math.round(display))
  const cue = phase === 'in' ? APP_COPY.breathIn : APP_COPY.breathOut

  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-2xl',
        'border border-[var(--vs-bordure)]',
        'bg-[color-mix(in_srgb,var(--vs-lunaire)_92%,var(--vs-azur))]',
        'dark:bg-[color-mix(in_srgb,var(--vs-nuit)_88%,var(--vs-abysse))]',
        'min-h-[17.5rem] sm:min-h-[19rem]',
      )}
      role="status"
      aria-live="polite"
      aria-label={`${cue}. Génération ${shown} pour cent. ${APP_COPY.breathInvite}`}
    >
      {/* Halo profond */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_55%_at_50%_42%,color-mix(in_srgb,var(--vs-azur)_22%,transparent),transparent_70%)] dark:bg-[radial-gradient(ellipse_70%_55%_at_50%_42%,color-mix(in_srgb,var(--vs-azur)_28%,transparent),transparent_72%)]"
      />

      {/* Onde respirante */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
        <div
          className={cn(
            'vs-breath-orb relative flex h-[11.5rem] w-[11.5rem] items-center justify-center sm:h-[12.5rem] sm:w-[12.5rem]',
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
          <span className="absolute inset-[22%] rounded-full bg-[radial-gradient(circle_at_50%_40%,color-mix(in_srgb,var(--vs-ecume)_55%,var(--vs-azur)),color-mix(in_srgb,var(--vs-azur)_55%,transparent)_62%,transparent_78%)] opacity-90 dark:bg-[radial-gradient(circle_at_50%_40%,color-mix(in_srgb,var(--vs-ecume)_35%,var(--vs-azur)),color-mix(in_srgb,var(--vs-azur)_45%,transparent)_65%,transparent_80%)]" />
          {/* Anneau de progression discret */}
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100" aria-hidden>
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="color-mix(in srgb, var(--vs-azur) 16%, transparent)"
              strokeWidth="1.2"
            />
            <circle
              cx="50"
              cy="50"
              r="46"
              fill="none"
              stroke="var(--vs-azur)"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeDasharray={`${(shown / 100) * 289} 289`}
              className="transition-[stroke-dasharray] duration-700 ease-out"
              opacity={0.85}
            />
          </svg>
        </div>
      </div>

      {/* Texte */}
      <div className="relative z-10 flex min-h-[17.5rem] flex-col items-center justify-center px-5 py-6 text-center sm:min-h-[19rem]">
        <p
          key={reduceMotion ? 'still' : cue}
          className={cn(
            'font-display text-[1.85rem] leading-none tracking-wide text-[var(--vs-nuit)] dark:text-[var(--vs-ecume)] sm:text-[2.1rem]',
            !reduceMotion && 'vs-breath-cue',
          )}
        >
          {reduceMotion ? APP_COPY.breathStill : cue}
        </p>
        <p className="mt-3 max-w-[17rem] text-[14px] leading-relaxed text-[var(--vs-nuit)]/70 dark:text-[var(--vs-brume)] sm:text-[15px]">
          {APP_COPY.breathInvite}
        </p>
        <p className="mt-5 text-[12px] tabular-nums tracking-[0.14em] text-[var(--vs-nuit)]/45 dark:text-[var(--vs-brume)]/80">
          {shown}% · {APP_COPY.breathAside}
        </p>
      </div>
    </div>
  )
}
