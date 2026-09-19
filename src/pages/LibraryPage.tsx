import { Link } from 'react-router-dom'
import { BookOpen, Cloud, Plus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SessionRow } from '@/components/library/SessionRow'
import { useSessions } from '@/context/SessionsContext'
import { cn } from '@/lib/utils'

export function LibraryPage() {
  const { sessions } = useSessions()

  if (sessions.length === 0) {
    return (
      <div className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-1 flex-col items-center justify-center pb-2 text-center">
        <header className="mb-6 w-full">
          <h1 className="font-display text-3xl tracking-tight text-ink dark:text-cream sm:text-4xl">
            Ma Bibliothèque
          </h1>
          <p className="mt-1.5 text-sm text-ink/68 dark:text-champagne/86">
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
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink/68 dark:text-champagne/86">
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
            className="text-ink/82 dark:text-champagne/90"
          />
          <p className="text-sm font-semibold text-ink dark:text-cream">Bientôt disponible :</p>
          <p className="max-w-sm text-sm leading-relaxed text-ink/68 dark:text-champagne/86">
            Tu pourras bientôt synchroniser et retrouver ici toutes tes visualisations et y
            accéder où que tu sois (tablette, smartphone, web).
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col items-center overflow-y-auto pb-2 text-center">
      <header className="w-full shrink-0">
        <h1 className="font-display text-3xl tracking-tight text-ink dark:text-cream">
          Ma Bibliothèque
        </h1>
        <p className="mt-1 text-sm text-ink/68 dark:text-champagne/86">
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

      <div className="mt-5 w-full space-y-1.5">
        {sessions.map((session) => (
          <SessionRow key={session.id} session={session} />
        ))}
      </div>
    </div>
  )
}
