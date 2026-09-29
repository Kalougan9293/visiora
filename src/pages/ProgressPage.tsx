import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CalendarDays, CircleCheck, HelpCircle, LogIn, Plus } from 'lucide-react'
import { AuthModal } from '@/components/auth/AuthModal'
import { WelcomeBack } from '@/components/progress/WelcomeBack'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LegalFooter } from '@/components/layout/LegalFooter'
import { MILESTONE_STEPS } from '@/components/progress/MilestonePopup'
import { useAuth } from '@/context/AuthContext'
import { authService } from '@/services/auth'
import { useSessions } from '@/context/SessionsContext'
import { PROGRESS_COPY } from '@/data/uiCopy'
import { cn } from '@/lib/utils'
import { nextMilestoneTarget, progressService, rhythmSentence } from '@/services/progress'

const SELECTED_KEY = 'visiora-suivi-session'

function deleteAccountMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  const lower = raw.toLowerCase()
  if (lower.includes('admin')) return 'Ce compte ne peut pas être supprimé ici.'
  if (lower.includes('not authorized') || lower.includes('unauthorized') || lower.includes('jwt')) {
    return 'Connexion requise'
  }
  if (lower.includes('delete_own_account') || lower.includes('not found') || lower.includes('404')) {
    return 'La suppression du compte n’est pas encore activée.'
  }
  return 'Suppression impossible'
}

export function ProgressPage() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const { sessions, sessionsReady, listenMarks } = useSessions()
  const [authOpen, setAuthOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SELECTED_KEY)
    } catch {
      return null
    }
  })
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const selected = sessions.find((session) => session.id === selectedId) ?? sessions[0] ?? null

  useEffect(() => {
    if (!selected) return
    try {
      localStorage.setItem(SELECTED_KEY, selected.id)
    } catch {
      /* stockage indisponible */
    }
  }, [selected])

  const stats = selected ? progressService.statsForSession(listenMarks, selected.id) : null

  const days = stats?.daysCompletedTowardMilestone ?? 0
  const milestoneTarget = nextMilestoneTarget(days)
  const remaining = Math.max(0, milestoneTarget - days)
  const journal14 = stats?.journal.slice(-14) ?? []
  const todayKey = new Date().toISOString().slice(0, 10)
  const pct = milestoneTarget > 0 ? Math.min(100, (days / milestoneTarget) * 100) : 0
  const rhythm = stats ? rhythmSentence(stats.journal) : ''
  const doneFinal = days >= 60

  useEffect(() => {
    if (!deleteOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !deleteBusy) setDeleteOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [deleteOpen, deleteBusy])

  const confirmDeleteAccount = async () => {
    if (deleteBusy) return
    setDeleteBusy(true)
    setDeleteError('')
    try {
      await authService.deleteOwnAccount()
      try {
        await signOut()
      } catch {
        /* la session est déjà partie avec le compte */
      }
      setDeleteOpen(false)
      navigate('/', { replace: true })
    } catch (err) {
      setDeleteError(deleteAccountMessage(err))
      setDeleteBusy(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center space-y-4 pb-4 text-center">
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <header className="w-full">
        <h1 className="font-display text-3xl tracking-tight text-ink dark:text-cream sm:text-[2rem]">
          {PROGRESS_COPY.title}
        </h1>
        <p className="mt-1.5 text-sm text-ink/68 dark:text-champagne/86">
          {PROGRESS_COPY.subtitle}
        </p>
      </header>

      {!sessionsReady && (
        <p className="text-sm text-ink/68 dark:text-champagne/86">Chargement…</p>
      )}

      {sessionsReady && !user && (
        <Card className="w-full !p-6">
          <p className="text-sm leading-relaxed text-ink/72 dark:text-champagne/88">
            {PROGRESS_COPY.lockedBody}
          </p>
          <Button className="mt-5 w-full rounded-full" onClick={() => setAuthOpen(true)}>
            <LogIn size={18} />
            {PROGRESS_COPY.lockedCta}
          </Button>
        </Card>
      )}

      {sessionsReady && user && sessions.length === 0 && (
        <Card className="w-full !p-6">
          <h2 className="text-sm font-semibold text-ink dark:text-cream">{PROGRESS_COPY.emptyTitle}</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink/72 dark:text-champagne/88">
            {PROGRESS_COPY.emptyBody}
          </p>
          <Link to="/creer" className="mt-5 inline-block w-full">
            <Button className="w-full rounded-full">
              <Plus size={18} />
              {PROGRESS_COPY.emptyCta}
            </Button>
          </Link>
        </Card>
      )}

      {selected && stats && (
        <>
          <select
            aria-label="Visualisation"
            value={selected.id}
            onChange={(event) => setSelectedId(event.target.value)}
            className="w-full rounded-2xl border border-black/10 bg-[var(--vs-surface)] px-3 py-3 text-center text-sm text-ink [text-align-last:center] dark:border-[var(--vs-bordure)] dark:text-cream"
          >
            {sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.title}
              </option>
            ))}
          </select>

          <WelcomeBack stats={stats} />

          <div className="grid w-full grid-cols-2 gap-3">
            <Card className="!p-4 text-center">
              <div className="flex flex-col items-center">
                <CircleCheck
                  size={18}
                  className="text-ink/52 dark:text-champagne/72"
                  strokeWidth={1.75}
                />
                <span className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/58 dark:text-champagne/78">
                  {PROGRESS_COPY.listens}
                </span>
              </div>
              <p className="mt-3 font-sans text-4xl font-medium leading-none tabular-nums tracking-tight text-ink dark:text-cream">
                {stats.totalListens}
              </p>
            </Card>

            <Card className="!p-4 text-center">
              <div className="flex flex-col items-center">
                <CalendarDays size={18} className="text-[var(--vs-azur)]" strokeWidth={1.75} />
                <span className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/58 dark:text-champagne/78">
                  {PROGRESS_COPY.practiceDays}
                </span>
              </div>
              <p className="mt-3 font-sans text-4xl font-medium leading-none tabular-nums tracking-tight text-ink dark:text-cream">
                {days}
              </p>
            </Card>
          </div>

          <Card className="w-full !p-5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/58 dark:text-[var(--vs-texte-faible)]">
              {PROGRESS_COPY.nextLabel}
            </p>
            {!doneFinal && (
              <>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-[var(--vs-azur)] transition-[width] duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-3 text-sm leading-relaxed text-ink/68 dark:text-champagne/86">
                  {PROGRESS_COPY.nextBody(remaining)}
                </p>
              </>
            )}
            <p className="mt-4 text-xs tracking-wide text-ink/50 dark:text-champagne/70">
              {MILESTONE_STEPS.map((step) => `${step} j`).join(' · ')}
            </p>
          </Card>

          <Card className="w-full !p-5 text-center">
            <h2 className="text-sm font-semibold text-ink dark:text-cream">
              {PROGRESS_COPY.journalTitle}
            </h2>

            <div className="mt-4 grid grid-cols-7 gap-2">
              {journal14.map((day) => {
                const d = new Date(day.date + 'T12:00:00')
                const label = d.toLocaleDateString('fr-FR', { weekday: 'narrow' })
                const num = d.getDate()
                const isToday = day.date === todayKey
                return (
                  <div
                    key={day.date}
                    title={day.date}
                    className="flex aspect-[3/4] flex-col items-center justify-center text-[10px] text-ink/62 dark:text-champagne/82"
                  >
                    <span className="opacity-70">{label}</span>
                    <span className={cn('mt-0.5 text-xs font-medium', isToday && 'text-ink dark:text-cream')}>
                      {num}
                    </span>
                    <span
                      className={cn(
                        'mt-1 h-1.5 w-1.5 rounded-full',
                        day.completed ? 'bg-[var(--vs-azur)]' : 'bg-transparent',
                      )}
                      aria-hidden
                    />
                  </div>
                )
              })}
            </div>
            <p className="mt-4 text-sm leading-relaxed text-ink/68 dark:text-champagne/86">
              {rhythm}
            </p>
          </Card>
        </>
      )}

      <Card className="w-full !p-5 text-left">
        <div className="flex flex-col items-center gap-1.5 text-center">
          <HelpCircle size={16} strokeWidth={1.75} className="text-ink/68 dark:text-champagne/86" />
          <h2 className="text-sm font-semibold text-ink dark:text-cream">
            {PROGRESS_COPY.whyTitle}
          </h2>
        </div>
        <div className="mt-4 space-y-4 text-sm leading-relaxed text-ink/72 dark:text-champagne/88">
          <p>
            <span className="font-semibold text-ink dark:text-cream">La répétition. </span>
            {PROGRESS_COPY.whyRepeat}
          </p>
          <p>
            <span className="font-semibold text-ink dark:text-cream">Combien de temps. </span>
            {PROGRESS_COPY.whyDuration}
          </p>
          <p>
            <span className="font-semibold text-ink dark:text-cream">La régularité avant la durée. </span>
            {PROGRESS_COPY.whyRegularity}
          </p>
          <p>
            <span className="font-semibold text-ink dark:text-cream">Le bon moment. </span>
            {PROGRESS_COPY.whyMoment}
          </p>
        </div>
      </Card>

      {sessions.length === 0 && <LegalFooter />}

      {user && (
        <button
          type="button"
          onClick={() => {
            setDeleteError('')
            setDeleteOpen(true)
          }}
          className="pt-8 text-xs text-ink/45 underline decoration-ink/25 underline-offset-4 transition-colors hover:text-ink hover:decoration-ink dark:text-champagne/55 dark:decoration-white/20 dark:hover:text-white dark:hover:decoration-white"
        >
          {PROGRESS_COPY.deleteAccount}
        </button>
      )}

      {deleteOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center px-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
        >
          <button
            type="button"
            aria-label="Fermer"
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              if (!deleteBusy) setDeleteOpen(false)
            }}
          />
          <div className="relative w-full max-w-[19rem] rounded-2xl border border-[var(--vs-bordure)] bg-[var(--vs-surface)] px-5 py-5 text-center text-ink dark:text-[var(--vs-ecume)]">
            <p id="delete-account-title" className="text-sm font-medium">
              {PROGRESS_COPY.deleteAccountTitle}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-ink/60 dark:text-champagne/75">
              {PROGRESS_COPY.deleteAccountBody}
            </p>
            {deleteError && <p className="mt-2 text-xs text-[var(--vs-or)]">{deleteError}</p>}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => setDeleteOpen(false)}
                className="flex-1 rounded-xl border border-black/12 px-3 py-2 text-xs font-medium text-ink/80 disabled:opacity-40 dark:border-[var(--vs-ardoise)] dark:text-[var(--vs-lunaire)]"
              >
                {PROGRESS_COPY.deleteAccountCancel}
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => void confirmDeleteAccount()}
                className="flex-1 rounded-xl bg-[var(--vs-or)] px-3 py-2 text-xs font-medium text-[var(--vs-nuit)] disabled:opacity-40"
              >
                {deleteBusy ? '…' : PROGRESS_COPY.deleteAccountConfirm}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
