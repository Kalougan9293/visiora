import { Pause, Play } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { usePlayback } from '@/context/PlaybackContext'
import { cn } from '@/lib/utils'

function formatClock(seconds: number) {
  const total = Math.max(0, Math.round(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Lecteur fixe, au-dessus des onglets. Caché dans la bibliothèque, où la séance a déjà le sien. */
export function MiniPlayer() {
  const { pathname } = useLocation()
  const playback = usePlayback()
  const visible = Boolean(playback.sessionId) && !playback.ended && pathname !== '/bibliotheque'
  if (!visible) return null

  const progress = playback.duration > 0 ? Math.min(100, (playback.current / playback.duration) * 100) : 0

  return (
    <div
      className="fixed left-1/2 z-40 w-full max-w-[35rem] -translate-x-1/2 px-3"
      style={{ bottom: 'calc(4.35rem + env(safe-area-inset-bottom))' }}
    >
      <div
        className={cn(
          'flex items-center gap-3 rounded-2xl border px-3 py-2 shadow-lg',
          'border-[var(--vs-bordure)] bg-[var(--vs-surface)]',
        )}
      >
        <button
          type="button"
          onClick={() => void playback.toggle()}
          aria-label={playback.playing ? 'Pause' : 'Lecture'}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--vs-or)] text-[var(--vs-nuit)]"
        >
          {playback.playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </button>
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-medium text-ink dark:text-cream">{playback.title}</p>
          <p className="text-[11px] tabular-nums text-ink/55 dark:text-champagne/75">
            {formatClock(playback.current)}
          </p>
          <div className="mt-1 h-0.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
            <div className="h-full rounded-full bg-[var(--vs-azur)]" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    </div>
  )
}
