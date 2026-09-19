import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { AudioPlayer } from '@/components/audio/AudioPlayer'
import { useSessions } from '@/context/SessionsContext'
import { useVariant } from '@/context/VariantContext'
import { formatDateFr, cn } from '@/lib/utils'
import { ambianceFromAnswers } from '@/services/ambiance'
import type { VisualizationSession } from '@/types'

export function SessionRow({ session }: { session: VisualizationSession }) {
  const { isAqua } = useVariant()
  const { removeSession, markListened, retryGeneration } = useSessions()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const ready = session.status === 'ready' || Boolean(session.audioUrl)
  const pct = Math.min(99, Math.max(5, Math.round(session.audioProgress ?? 8)))

  const meta =
    session.status === 'generating'
      ? `${pct}%`
      : session.status === 'draft' && !session.audioUrl
        ? 'connexion'
        : formatDateFr(session.createdAt)

  useEffect(() => {
    if (!confirmOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [confirmOpen])

  return (
    <>
    <div
      className={cn(
        'flex h-11 w-full min-w-0 items-center gap-2 px-2.5',
        isAqua
          ? 'aqua-glass rounded-xl'
          : 'rounded-xl border border-black/8 bg-cream-card/80 dark:border-[var(--vs-ardoise)] dark:bg-[var(--vs-abysse)]',
      )}
    >
      <span
        className={cn(
          'w-[5.75rem] shrink-0 truncate text-left text-[11px]',
          isAqua ? 'text-[#b8e4ea]/85' : 'text-ink/55 dark:text-champagne/85',
        )}
      >
        {meta}
      </span>

      <p
        className={cn(
          'min-w-0 flex-1 truncate text-center text-sm font-medium',
          isAqua ? 'text-[#e8f7f9]' : 'text-ink dark:text-cream',
        )}
      >
        {session.title}
      </p>

      {session.status === 'failed' && (
        <button
          type="button"
          onClick={() => void retryGeneration(session.id)}
          className={cn(
            'shrink-0 text-[10px] underline',
            isAqua ? 'text-red-300' : 'text-red-600 dark:text-red-300',
          )}
        >
          Réessayer
        </button>
      )}

      <button
        type="button"
        aria-label="Supprimer"
        onClick={() => setConfirmOpen(true)}
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
          isAqua
            ? 'text-[#b8e4ea]/70 hover:bg-white/10 hover:text-red-300'
            : 'text-ink/40 hover:bg-black/5 hover:text-red-500 dark:text-champagne/70 dark:hover:bg-white/5',
        )}
      >
        <Trash2 size={14} />
      </button>

      {ready ? (
        <AudioPlayer
          compact
          src={session.audioUrl}
          title={session.title}
          ambiance={ambianceFromAnswers(session.answers)}
          onPlayStart={() => markListened(session.id)}
        />
      ) : (
        <span className="h-9 w-9 shrink-0" aria-hidden />
      )}
    </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center px-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`confirm-del-${session.id}`}
        >
          <button
            type="button"
            aria-label="Fermer"
            className="absolute inset-0 bg-black/50"
            onClick={() => setConfirmOpen(false)}
          />
          <div
            className={cn(
              'relative w-full max-w-[17rem] rounded-2xl border px-5 py-5 text-center shadow-xl',
              isAqua
                ? 'border-white/15 bg-[#0d3d47] text-[#e8f7f9]'
                : 'border-black/10 bg-cream text-ink dark:border-[var(--vs-ardoise)] dark:bg-[var(--vs-abysse)] dark:text-[var(--vs-ecume)]',
            )}
          >
            <p id={`confirm-del-${session.id}`} className="text-sm font-medium">
              Êtes-vous sûr ?
            </p>
            <p
              className={cn(
                'mt-1 truncate text-xs',
                isAqua ? 'text-[#b8e4ea]/80' : 'text-ink/55 dark:text-champagne/80',
              )}
            >
              {session.title}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className={cn(
                  'flex-1 rounded-xl border px-3 py-2 text-xs font-medium',
                  isAqua
                    ? 'border-white/20 text-[#e8f7f9]/90'
                    : 'border-black/12 text-ink/80 dark:border-[var(--vs-ardoise)] dark:text-[var(--vs-lunaire)]',
                )}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmOpen(false)
                  removeSession(session.id)
                }}
                className={cn(
                  'flex-1 rounded-xl px-3 py-2 text-xs font-medium',
                  isAqua
                    ? 'bg-red-500/90 text-white'
                    : 'bg-red-600 text-white dark:bg-red-500',
                )}
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
