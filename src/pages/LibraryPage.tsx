import { Link } from 'react-router-dom'
import { BookOpen, Cloud, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { AudioPlayer } from '@/components/audio/AudioPlayer'
import { useSessions } from '@/context/SessionsContext'
import { formatDateFr, cn } from '@/lib/utils'

export function LibraryPage() {
  const { sessions, removeSession, markListened } = useSessions()

  if (sessions.length === 0) {
    return (
      <div className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-1 flex-col items-center justify-center pb-2 text-center">
        <header className="mb-6 w-full">
          <h1 className="font-display text-3xl tracking-tight text-ink dark:text-cream sm:text-4xl">
            Ma Bibliothèque
          </h1>
          <p className="mt-1.5 text-sm text-ink/55 dark:text-champagne/70">
            Tes séances personnalisées sauvegardées sur cet appareil
          </p>
        </header>

        <div
          className={cn(
            'flex w-full flex-col items-center rounded-3xl border border-dashed px-6 py-10 text-center',
            'border-black/15 bg-black/[0.03] dark:border-champagne/25 dark:bg-white/[0.04]',
          )}
        >
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-sm dark:bg-white/10">
            <BookOpen size={24} strokeWidth={1.5} className="text-ink dark:text-cream" />
          </div>
          <h2 className="text-lg font-semibold text-ink dark:text-cream">Aucune séance</h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink/55 dark:text-champagne/70">
            Tu n&apos;as pas encore créé de visualisation guidée. Rends-toi sur l&apos;onglet
            &apos;Créer&apos; pour concevoir ta première séance !
          </p>
          <Link to="/creer" className="mt-7 w-full max-w-xs">
            <Button size="lg" className="w-full rounded-full">
              <Plus size={18} />
              Créer ma première séance
            </Button>
          </Link>
        </div>

        <div
          className={cn(
            'mt-4 flex w-full flex-col items-center gap-2 rounded-2xl px-4 py-4 text-center',
            'bg-black/[0.04] dark:bg-white/[0.06]',
          )}
        >
          <Cloud
            size={20}
            strokeWidth={1.6}
            className="text-ink/70 dark:text-champagne/80"
          />
          <p className="text-sm font-semibold text-ink dark:text-cream">Bientôt disponible :</p>
          <p className="max-w-sm text-sm leading-relaxed text-ink/55 dark:text-champagne/70">
            Tu pourras bientôt synchroniser et retrouver ici toutes tes visualisations et y
            accéder où que tu sois (tablette, smartphone, web).
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-1 flex-col items-center overflow-y-auto pb-2 text-center">
      <header className="w-full shrink-0">
        <h1 className="font-display text-3xl tracking-tight text-ink dark:text-cream">
          Ma Bibliothèque
        </h1>
        <p className="mt-1 text-sm text-ink/55 dark:text-champagne/70">
          {sessions.length} séance{sessions.length > 1 ? 's' : ''} sauvegardée
          {sessions.length > 1 ? 's' : ''} sur cet appareil
        </p>
        <Link to="/creer" className="mt-4 inline-block w-full">
          <Button size="sm" variant="outline" className="w-full rounded-full">
            <Plus size={16} />
            Nouvelle
          </Button>
        </Link>
      </header>

      <div className="mt-5 w-full space-y-3">
        {sessions.map((session) => (
          <Card key={session.id} className="!p-4 space-y-3 text-center">
            <div className="flex flex-col items-center gap-2">
              <h2 className="font-medium text-ink dark:text-cream">{session.title}</h2>
              <p className="text-xs text-ink/65 dark:text-champagne/75">
                {formatDateFr(session.createdAt)} · {session.durationMinutes} min ·{' '}
                {session.listens} écoute{session.listens !== 1 ? 's' : ''}
              </p>
              <button
                type="button"
                aria-label="Supprimer"
                onClick={() => removeSession(session.id)}
                className="rounded-lg p-2 text-ink/50 transition-colors hover:bg-black/5 hover:text-red-500 dark:text-champagne/70 dark:hover:bg-white/5"
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
          </Card>
        ))}
      </div>
    </div>
  )
}
