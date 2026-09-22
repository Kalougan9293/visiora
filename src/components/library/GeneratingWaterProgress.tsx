import { useEffect, useState } from 'react'
import { APP_COPY } from '@/data/uiCopy'
import { cn } from '@/lib/utils'

/**
 * Niveau d'eau : suit le serveur, et continue de monter doucement
 * pendant un long TTS (évite le faux « bloqué à 33 % »).
 * Pas d'animation en boucle — uniquement la hauteur qui avance.
 */
export function GeneratingWaterProgress({ serverPct }: { serverPct: number }) {
  const server = Math.min(99, Math.max(5, Math.round(serverPct)))
  const [display, setDisplay] = useState(server)

  useEffect(() => {
    setDisplay((prev) => Math.max(prev, server))
  }, [server])

  useEffect(() => {
    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
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

  const shown = Math.min(99, Math.round(display))
  const waterH = Math.max(12, shown)

  return (
    <div
      className={cn(
        'relative h-[9.5rem] w-full overflow-hidden rounded-2xl sm:h-40',
        'border border-[var(--vs-bordure)] bg-[var(--vs-abysse)]',
      )}
      role="status"
      aria-live="polite"
      aria-label={`Génération ${shown} pour cent`}
    >
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 bg-[var(--vs-azur)]/45 transition-[height] duration-700 ease-out motion-reduce:transition-none"
        style={{ height: `${waterH}%` }}
        aria-hidden
      />

      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-1.5 px-4">
        <p className="font-display text-4xl tracking-tight tabular-nums text-[var(--vs-lunaire)] sm:text-5xl">
          {shown}%
        </p>
        <p className="max-w-[16rem] text-center text-[11px] leading-relaxed text-[var(--vs-brume)] sm:text-xs">
          {APP_COPY.generating}
        </p>
      </div>
    </div>
  )
}
