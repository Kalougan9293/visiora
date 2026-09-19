import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { FlickeringCandle } from '@/components/aqua/FlickeringCandle'
import { SessionRow } from '@/components/library/SessionRow'
import { useSessions } from '@/context/SessionsContext'

export function AquaLibraryPage() {
  const { sessions } = useSessions()

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
    <div className="flex h-full min-h-0 w-full flex-1 flex-col items-center overflow-y-auto pb-2 text-center">
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

      <div className="mt-5 w-full space-y-1.5">
        {sessions.map((session) => (
          <SessionRow key={session.id} session={session} />
        ))}
      </div>
    </div>
  )
}
