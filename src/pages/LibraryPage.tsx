import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BookOpen, LogIn, Plus } from 'lucide-react'
import { AuthModal } from '@/components/auth/AuthModal'
import { Button } from '@/components/ui/Button'
import { LegalFooter } from '@/components/layout/LegalFooter'
import { SessionRow } from '@/components/library/SessionRow'
import { useAuth } from '@/context/AuthContext'
import { useSessions } from '@/context/SessionsContext'
import { LIBRARY_COPY } from '@/data/uiCopy'
import { cn } from '@/lib/utils'

export function LibraryPage() {
  const { user, loading } = useAuth()
  const { sessions } = useSessions()
  const [authOpen, setAuthOpen] = useState(false)
  const notice = (useLocation().state as { notice?: string } | null)?.notice

  if (loading) {
    return (
      <div className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-1 flex-col items-center justify-center pb-2 text-center">
        <p className="text-sm text-ink/68 dark:text-champagne/86">Chargement…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-1 flex-col items-center justify-center pb-2 text-center">
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
        <header className="mb-6 w-full">
          <h1 className="font-display text-3xl tracking-tight text-ink dark:text-cream sm:text-4xl">
            {LIBRARY_COPY.title}
          </h1>
          <p className="mt-1.5 text-sm text-ink/68 dark:text-champagne/86">
            {LIBRARY_COPY.subtitle}
          </p>
        </header>

        <div
          className={cn(
            'flex w-full flex-col items-center rounded-3xl border border-dashed px-6 py-10 text-center',
            'border-[var(--vs-bordure)] bg-[var(--vs-surface)]',
          )}
        >
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--vs-azur)]/15">
            <BookOpen size={24} strokeWidth={1.5} className="text-ink dark:text-cream" />
          </div>
          <h2 className="text-lg font-semibold text-ink dark:text-cream">{LIBRARY_COPY.lockedTitle}</h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink/68 dark:text-champagne/86">
            {LIBRARY_COPY.lockedBody}
          </p>
          <Button
            size="lg"
            className="mt-7 w-full max-w-xs rounded-full"
            onClick={() => setAuthOpen(true)}
          >
            <LogIn size={18} />
            {LIBRARY_COPY.lockedCta}
          </Button>
        </div>
        <LegalFooter />
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-1 flex-col items-center justify-center pb-2 text-center">
        <header className="mb-6 w-full">
          <h1 className="font-display text-3xl tracking-tight text-ink dark:text-cream sm:text-4xl">
            {LIBRARY_COPY.title}
          </h1>
          <p className="mt-1.5 text-sm text-ink/68 dark:text-champagne/86">
            {LIBRARY_COPY.subtitle}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink/68 dark:text-champagne/86">
            {LIBRARY_COPY.limit}
          </p>
          {notice && (
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[var(--vs-or)]">{notice}</p>
          )}
        </header>

        <div
          className={cn(
            'flex w-full flex-col items-center rounded-3xl border border-dashed px-6 py-10 text-center',
            'border-[var(--vs-bordure)] bg-[var(--vs-surface)]',
          )}
        >
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--vs-azur)]/15">
            <BookOpen size={24} strokeWidth={1.5} className="text-ink dark:text-cream" />
          </div>
          <h2 className="text-lg font-semibold text-ink dark:text-cream">{LIBRARY_COPY.emptyTitle}</h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink/68 dark:text-champagne/86">
            {LIBRARY_COPY.emptyBody}
          </p>
          <Link to="/creer" className="mt-7 w-full max-w-xs">
            <Button size="lg" className="w-full rounded-full">
              <Plus size={18} />
              {LIBRARY_COPY.emptyCta}
            </Button>
          </Link>
        </div>
        <LegalFooter />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col items-center overflow-y-auto pb-2 text-center">
      <header className="w-full shrink-0">
        <h1 className="font-display text-3xl tracking-tight text-ink dark:text-cream">
          {LIBRARY_COPY.title}
        </h1>
        <p className="mt-1 text-sm text-ink/68 dark:text-champagne/86">
          {LIBRARY_COPY.subtitle}
        </p>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink/68 dark:text-champagne/86">
          {LIBRARY_COPY.limit}
        </p>
        {notice && (
          <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[var(--vs-or)]">{notice}</p>
        )}
        {!sessions.some((s) => s.status === 'generating') && (
          <Link to="/creer" className="mt-4 inline-block w-full">
            <Button size="sm" variant="outline" className="w-full rounded-full">
              <Plus size={16} />
              Nouvelle
            </Button>
          </Link>
        )}
      </header>

      <div className="mt-5 w-full space-y-1.5">
        {sessions.map((session) => (
          <SessionRow key={session.id} session={session} />
        ))}
      </div>
      <LegalFooter className="pb-2" />
    </div>
  )
}
