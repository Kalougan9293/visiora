import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, CircleCheck, HelpCircle, LogIn, Plus, RotateCcw } from 'lucide-react'
import { AuthModal } from '@/components/auth/AuthModal'
import { WelcomeBack } from '@/components/progress/WelcomeBack'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { LegalFooter } from '@/components/layout/LegalFooter'
import {
  MILESTONE_STEPS,
  MilestonePopup,
  type MilestoneDays,
} from '@/components/progress/MilestonePopup'
import { useAuth } from '@/context/AuthContext'
import { useSessions } from '@/context/SessionsContext'
import { PROGRESS_COPY } from '@/data/uiCopy'
import { cn } from '@/lib/utils'
import { nextMilestoneTarget, progressService, rhythmSentence } from '@/services/progress'
import type { ProgressStats } from '@/types'

const SELECTED_KEY = 'visiora-suivi-session'

export function ProgressPage() {
  const { user } = useAuth()
  const { sessions, sessionsReady, listenMarks } = useSessions()
  const [authOpen, setAuthOpen] = useState(false)
  const [popupDays, setPopupDays] = useState<MilestoneDays | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SELECTED_KEY)
    } catch {
      return null
    }
  })
  const [previewById, setPreviewById] = useState<Record<string, ProgressStats>>({})

  const selected = sessions.find((session) => session.id === selectedId) ?? sessions[0] ?? null

  useEffect(() => {
    if (!selected) return
    try {
      localStorage.setItem(SELECTED_KEY, selected.id)
    } catch {
      /* stockage indisponible */
    }
  }, [selected])

  const stats = selected
    ? (previewById[selected.id] ?? progressService.statsForSession(listenMarks, selected.id))
    : null

  const days = stats?.daysCompletedTowardMilestone ?? 0
  const milestoneTarget = nextMilestoneTarget(days)
  const remaining = Math.max(0, milestoneTarget - days)
  const journal14 = stats?.journal.slice(-14) ?? []
  const todayKey = new Date().toISOString().slice(0, 10)
  const pct = milestoneTarget > 0 ? Math.min(100, (days / milestoneTarget) * 100) : 0
  const rhythm = stats ? rhythmSentence(stats.journal) : ''
  const doneFinal = days >= 60

  const runSim = (simDays: MilestoneDays) => {
    if (!selected) return
    setPreviewById((prev) => ({
      ...prev,
      [selected.id]: progressService.simulateDays(simDays),
    }))
    setPopupDays(simDays)
  }

  const resetPreview = () => {
    if (!selected) return
    setPreviewById((prev) => {
      const next = { ...prev }
      delete next[selected.id]
      return next
    })
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

          {import.meta.env.DEV && (
            <div
              className={cn(
                'w-full rounded-2xl border border-dashed px-4 py-5 text-center',
                'border-black/15 bg-black/[0.02] dark:border-champagne/20 dark:bg-white/[0.03]',
              )}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--vs-azur)]">
                Zone de test — {selected.title}
              </p>
              <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
                <button
                  type="button"
                  onClick={() => runSim(21)}
                  className="inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-full border border-black/10 bg-cream-soft px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-black/[0.06] dark:border-champagne/20 dark:bg-white/10 dark:text-cream dark:hover:bg-white/15 sm:w-auto"
                >
                  <Plus size={15} />
                  Simuler 21 jours
                </button>
                <button
                  type="button"
                  onClick={() => runSim(60)}
                  className="inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-full border border-black/10 bg-cream-soft px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-black/[0.06] dark:border-champagne/20 dark:bg-white/10 dark:text-cream dark:hover:bg-white/15 sm:w-auto"
                >
                  <Plus size={15} />
                  Simuler 60 jours
                </button>
                <button
                  type="button"
                  onClick={resetPreview}
                  className="inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-full border border-[var(--vs-or)]/35 bg-[var(--vs-or)]/10 px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-[var(--vs-or)]/18 dark:text-cream sm:w-auto"
                >
                  <RotateCcw size={15} />
                  Réinitialiser
                </button>
              </div>
            </div>
          )}
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

      {popupDays !== null && (
        <MilestonePopup days={popupDays} onClose={() => setPopupDays(null)} />
      )}
    </div>
  )
}
