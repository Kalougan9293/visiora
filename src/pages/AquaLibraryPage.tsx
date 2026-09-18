import { Link } from 'react-router-dom'
import { Plus, Trash2 } from 'lucide-react'
import { AudioPlayer } from '@/components/audio/AudioPlayer'
import { FlickeringCandle } from '@/components/aqua/FlickeringCandle'
import { useSessions } from '@/context/SessionsContext'
import { formatDateFr, cn } from '@/lib/utils'

export function AquaLibraryPage() {
  const { sessions, removeSession, markListened } = useSessions()

  if (sessions.length === 0) {
    return (
      <div className="relative mx-auto flex h-full min-h-0 w-full max-w-lg flex-1 flex-col items-center justify-center pb-2 text-center">
        <header className="mb-6 w-full">
          <h1
            className="text-3xl text-[#e8f7f9] sm:text-4xl"
            style={{ fontFamily: 'var(--font-aqua-display)' }}
          >
            Ma Bibliothèque
          </h1>
          <p
            className="mt-1.5 text-sm text-[#b8e4ea]"
            style={{ fontFamily: 'var(--font-aqua-sans)' }}
          >
            Tes séances personnalisées sauvegardées sur cet appareil
          </p>
        </header>

        <div className="aqua-glass flex w-full flex-col items-center rounded-3xl border border-dashed border-white/25 px-6 py-10 text-center">
          <FlickeringCandle />
          <h2
            className="mt-6 text-lg text-[#e8f7f9]"
            style={{ fontFamily: 'var(--font-aqua-display)' }}
          >
            Aucune séance
          </h2>
          <p
            className="mt-2 max-w-sm text-sm leading-relaxed text-[#b8e4ea]"
            style={{ fontFamily: 'var(--font-aqua-sans)' }}
          >
            Ta bibliothèque accueillera chaque visualisation personnalisée — prête à
            réécouter, encore et encore.
          </p>
          <Link to="/creer" className="mt-7 w-full max-w-xs">
            <span className="aqua-cta aqua-cta-hero flex w-full items-center justify-center">
              <span>
                Créer ma première séance
                <Plus size={18} />
              </span>
            </span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-1 flex-col items-center overflow-y-auto pb-2 text-center">
      <header className="w-full shrink-0">
        <h1
          className="text-3xl text-[#e8f7f9]"
          style={{ fontFamily: 'var(--font-aqua-display)' }}
        >
          Ma Bibliothèque
        </h1>
        <p className="mt-1 text-sm text-[#b8e4ea]">
          {sessions.length} séance{sessions.length > 1 ? 's' : ''} sauvegardée
          {sessions.length > 1 ? 's' : ''}
        </p>
        <Link to="/creer" className="mt-4 inline-block w-full">
          <span className="aqua-cta flex w-full items-center justify-center gap-2 !py-2.5 text-sm">
            <span>
              <Plus size={16} />
              Nouvelle
            </span>
          </span>
        </Link>
      </header>

      <div className="mt-5 w-full space-y-3">
        {sessions.map((session) => (
          <div key={session.id} className={cn('aqua-glass space-y-3 rounded-2xl p-4 text-center')}>
            <div className="flex flex-col items-center gap-2">
              <h2 className="font-medium text-[#e8f7f9]">{session.title}</h2>
              <p className="text-xs text-[#b8e4ea]/80">
                {formatDateFr(session.createdAt)} · {session.durationMinutes} min ·{' '}
                {session.listens} écoute{session.listens !== 1 ? 's' : ''}
              </p>
              <button
                type="button"
                aria-label="Supprimer"
                onClick={() => removeSession(session.id)}
                className="rounded-lg p-2 text-[#b8e4ea]/70 transition-colors hover:bg-white/10 hover:text-red-300"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <AudioPlayer
              src={session.audioUrl}
              title={session.title}
              subtitle="Séance guidée personnalisée"
              onPlayStart={() => markListened(session.id)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
