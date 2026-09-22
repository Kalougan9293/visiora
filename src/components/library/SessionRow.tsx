import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, Download, Pencil, Trash2 } from 'lucide-react'
import { audioStorage } from '@/services/audioStorage'
import { AudioPlayer } from '@/components/audio/AudioPlayer'
import { GeneratingWaterProgress } from '@/components/library/GeneratingWaterProgress'
import { ScriptReader } from '@/components/library/ScriptReader'
import { useSessions } from '@/context/SessionsContext'
import { APP_COPY } from '@/data/uiCopy'
import { formatDateFr, cn } from '@/lib/utils'
import type { VisualizationSession } from '@/types'

export function SessionRow({ session }: { session: VisualizationSession }) {
  const navigate = useNavigate()
  const { removeSession, markListened, retryGeneration } = useSessions()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [scriptOpen, setScriptOpen] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const onHeardEnough = useCallback(() => markListened(session.id), [markListened, session.id])

  const downloadAudio = useCallback(async () => {
    if ((!session.audioUrl && !session.audioStoragePath) || downloading) return
    setDownloading(true)
    try {
      const slug = session.title
        .toLowerCase()
        .replace(/[^a-z0-9àâäéèêëïîôùûüç]+/gi, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40)
      const freshUrl = session.audioStoragePath
        ? await audioStorage.refreshSessionUrl(session.audioStoragePath)
        : null
      const url = freshUrl || session.audioUrl
      if (!url) return
      await audioStorage.downloadMp3(url, `visiora-${slug || 'seance'}.mp3`)
    } catch (err) {
      console.warn('[session] download', err)
    } finally {
      setDownloading(false)
    }
  }, [session.audioUrl, session.audioStoragePath, session.title, downloading])
  const ready = session.status === 'ready' || Boolean(session.audioUrl)
  const generating = session.status === 'generating'
  const pct = Math.min(99, Math.max(5, Math.round(session.audioProgress ?? 8)))
  const hasScript = Boolean(session.script?.trim()) || ready

  useEffect(() => {
    if (!confirmOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [confirmOpen])

  const shellClass =
    'w-full min-w-0 rounded-xl border border-black/8 bg-cream-card/80 dark:border-[var(--vs-ardoise)] dark:bg-[var(--vs-abysse)]'

  if (generating) {
    return <GeneratingWaterProgress serverPct={pct} />
  }

  return (
    <>
      <div className={cn(shellClass, 'flex min-h-11 items-center gap-2 px-2.5 py-1.5')}>
        <div className="flex min-w-0 flex-1 flex-col items-start text-left">
          <span
            className={cn(
              'truncate text-[11px]',
              'text-ink/55 dark:text-champagne/85',
            )}
          >
            {session.status === 'draft' && !session.audioUrl
              ? 'connexion'
              : formatDateFr(session.createdAt)}
          </span>
          <p
            className={cn(
              'w-full truncate text-sm font-medium',
              'text-ink dark:text-cream',
            )}
          >
            {session.title}
          </p>
          <span
            className={cn(
              'truncate text-[10px]',
              'text-ink/45 dark:text-champagne/70',
            )}
          >
            {session.durationMinutes} min · {session.listens} écoute
            {session.listens !== 1 ? 's' : ''}
          </span>
        </div>

        {hasScript && ready && (
          <button
            type="button"
            aria-expanded={scriptOpen}
            aria-label={scriptOpen ? 'Masquer le script' : 'Lire le script'}
            onClick={() => setScriptOpen((v) => !v)}
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
              'text-ink/40 hover:bg-black/5 dark:text-champagne/70 dark:hover:bg-white/5',
            )}
          >
            <ChevronDown
              size={16}
              className={cn('transition-transform', scriptOpen && 'rotate-180')}
            />
          </button>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1">
        {session.status === 'failed' && !ready && (
            <button
              type="button"
              onClick={() => void retryGeneration(session.id)}
              className={cn(
                'max-w-[12.5rem] shrink-0 text-left text-[10px] leading-snug underline',
                'text-[var(--vs-or)]',
              )}
            >
              {APP_COPY.generateError}
            </button>
          )}

          {ready && (session.audioUrl || session.audioStoragePath) && (
            <button
              type="button"
              aria-label="Télécharger le MP3"
              disabled={downloading}
              onClick={() => void downloadAudio()}
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
                'text-ink/40 hover:bg-black/5 dark:text-champagne/70 dark:hover:bg-white/5 disabled:opacity-40',
              )}
            >
              <Download size={14} />
            </button>
          )}

          {ready && (
            <button
              type="button"
              aria-label="Ajuster"
              onClick={() => navigate(`/creer?adjust=${session.id}`)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink/40 transition-colors hover:bg-black/5 dark:text-champagne/70 dark:hover:bg-white/5"
            >
              <Pencil size={14} />
            </button>
          )}

          <button
            type="button"
            aria-label="Supprimer"
            onClick={() => setConfirmOpen(true)}
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
              'text-ink/40 hover:bg-black/5 hover:text-[var(--vs-or)] dark:text-champagne/70 dark:hover:bg-white/5',
            )}
          >
            <Trash2 size={14} />
          </button>

          {ready && (
            <AudioPlayer
              compact
              src={session.audioUrl}
              title={session.title}
              onPlayStart={onHeardEnough}
            />
          )}
        </div>
      </div>

      {scriptOpen && (
        <div
          className={cn(
            'mt-1 rounded-2xl px-4 py-4',
            'border border-black/8 bg-cream-card/60 dark:border-[var(--vs-ardoise)] dark:bg-[var(--vs-abysse)]/80',
          )}
        >
          <ScriptReader script={session.script} />
        </div>
      )}

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
              'relative w-full max-w-[17rem] rounded-2xl border px-5 py-5 text-center',
              'border-[var(--vs-bordure)] bg-[var(--vs-surface)] text-ink dark:text-[var(--vs-ecume)]',
            )}
          >
            <p id={`confirm-del-${session.id}`} className="text-sm font-medium">
              Es-tu sûr ?
            </p>
            <p
              className={cn(
                'mt-1 truncate text-xs',
                'text-ink/55 dark:text-champagne/80',
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
                  'border-black/12 text-ink/80 dark:border-[var(--vs-ardoise)] dark:text-[var(--vs-lunaire)]',
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
                  'bg-[var(--vs-or)] text-[var(--vs-nuit)]',
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
