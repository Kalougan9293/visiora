import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Réservoir d’eau : suit le serveur, et continue de monter doucement
 * pendant un long TTS (évite le faux « bloqué à 33 % »).
 */
export function GeneratingWaterProgress({
  serverPct,
  isAqua,
}: {
  serverPct: number
  isAqua: boolean
}) {
  const server = Math.min(99, Math.max(5, Math.round(serverPct)))
  const [display, setDisplay] = useState(server)

  useEffect(() => {
    setDisplay((prev) => Math.max(prev, server))
  }, [server])

  useEffect(() => {
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
        isAqua
          ? 'border border-white/12 bg-[#061820]'
          : 'border border-black/10 bg-[#0b1c24] dark:border-white/10',
      )}
      role="status"
      aria-live="polite"
      aria-label={`Génération ${shown} pour cent`}
    >
      {/* Eau qui monte */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 transition-[height] duration-700 ease-out"
        style={{ height: `${waterH}%` }}
        aria-hidden
      >
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a4a5c] via-[#1a7a8c] to-[#3eb8c9]/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d5a6e]/40 via-transparent to-[#7ed4df]/15" />

        {/* Surface ondulante (2 couches décalées) */}
        <svg
          className="visiora-water-surface absolute -top-3 left-0 h-8 w-[200%]"
          viewBox="0 0 1200 48"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            className="visiora-water-wave-fill opacity-90"
            d="M0,24 C150,8 300,40 450,24 C600,8 750,40 900,24 C1050,8 1200,40 1200,24 L1200,48 L0,48 Z"
            fill="#9ae4ef"
          />
        </svg>
        <svg
          className="visiora-water-surface visiora-water-surface-slow absolute -top-1 left-0 h-6 w-[200%] opacity-55"
          viewBox="0 0 1200 40"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            d="M0,18 C120,4 240,32 360,18 C480,4 600,32 720,18 C840,4 960,32 1080,18 C1140,10 1200,26 1200,18 L1200,40 L0,40 Z"
            fill="#e8f7f9"
          />
        </svg>
      </div>

      {/* Reflet léger en haut du réservoir */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/10 to-transparent"
        aria-hidden
      />

      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-1.5 px-4">
        <p className="font-display text-4xl tracking-tight tabular-nums text-[#e8f7f9] sm:text-5xl">
          {shown}%
        </p>
        <p className="text-xs text-[#b8e4ea]/80 sm:text-sm">Génération en cours…</p>
      </div>
    </div>
  )
}
