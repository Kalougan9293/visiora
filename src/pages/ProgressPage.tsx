import { useState } from 'react'
import { Award, CalendarDays, CircleCheck, Flame, HelpCircle, Plus, RotateCcw } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import {
  MilestonePopup,
  type MilestoneDays,
} from '@/components/progress/MilestonePopup'
import { useSessions } from '@/context/SessionsContext'
import { cn } from '@/lib/utils'

const MILESTONE_WISDOM =
  'Tu as posé les fondations. Ta nouvelle image mentale commence à s’installer.'

export function ProgressPage() {
  const { stats, simulateProgress, resetProgress } = useSessions()
  const { streakDays, totalListens, milestoneTarget, daysCompletedTowardMilestone, journal } =
    stats
  const [popupDays, setPopupDays] = useState<MilestoneDays | null>(null)

  const remaining = Math.max(0, milestoneTarget - daysCompletedTowardMilestone)
  const journal14 = journal.slice(-14)
  const todayKey = new Date().toISOString().slice(0, 10)
  const pct = Math.min(100, (daysCompletedTowardMilestone / milestoneTarget) * 100)

  const runSim = (days: MilestoneDays) => {
    simulateProgress(days)
    setPopupDays(days)
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center space-y-4 pb-4 text-center">
      <header className="w-full">
        <h1 className="font-display text-3xl tracking-tight text-ink dark:text-cream sm:text-[2rem]">
          Mon Suivi & Progrès
        </h1>
        <p className="mt-1.5 text-sm text-ink/68 dark:text-champagne/86">
          Régularité de l&apos;ancrage mental quotidien
        </p>
      </header>

      <div className="grid w-full grid-cols-2 gap-3">
        <Card className="!p-4 text-left">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/58 dark:text-champagne/78">
              Série active
            </span>
            <Flame size={18} className="text-olive dark:text-[var(--vs-azur)]" strokeWidth={1.75} />
          </div>
          <p className="mt-3 font-display text-4xl leading-none text-ink dark:text-cream">
            {streakDays}
          </p>
          <p className="mt-1 text-xs text-ink/62 dark:text-champagne/82">jours consécutifs</p>
        </Card>

        <Card className="!p-4 text-left">
          <div className="flex items-start justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/58 dark:text-champagne/78">
              Écoutes totales
            </span>
            <CircleCheck
              size={18}
              className="text-ink/52 dark:text-champagne/72"
              strokeWidth={1.75}
            />
          </div>
          <p className="mt-3 font-display text-4xl leading-none text-ink dark:text-cream">
            {totalListens}
          </p>
          <p className="mt-1 text-xs text-ink/62 dark:text-champagne/82">
            séance{totalListens !== 1 ? 's' : ''} validée{totalListens !== 1 ? 's' : ''}
          </p>
        </Card>
      </div>

      <Card className="w-full !p-5 text-left">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/58 dark:text-[var(--vs-texte-faible)]">
          <Award size={14} strokeWidth={1.75} />
          Objectif palier
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <h2 className="text-base font-semibold text-ink dark:text-cream">
            Prochain palier : Jour {milestoneTarget}
          </h2>
          <span className="shrink-0 text-xs text-ink/58 dark:text-champagne/78">
            {daysCompletedTowardMilestone}/{milestoneTarget} jours
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
          <div
            className="h-full rounded-full bg-olive transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink/68 dark:text-champagne/86">
          Il te reste encore {remaining} jour{remaining !== 1 ? 's' : ''} d&apos;écoute régulière
          pour consolider ce palier de progression.
        </p>
        <div className="mt-4 rounded-xl bg-black/[0.04] px-4 py-3 dark:bg-white/[0.06]">
          <p className="text-sm font-semibold text-ink dark:text-cream">Sagesse du Palier :</p>
          <p className="mt-1 text-sm italic leading-relaxed text-ink/72 dark:text-champagne/88">
            « {MILESTONE_WISDOM} »
          </p>
        </div>
      </Card>

      <Card className="w-full !p-5 text-left">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays
              size={16}
              strokeWidth={1.75}
              className="text-ink/68 dark:text-champagne/86"
            />
            <h2 className="text-sm font-semibold text-ink dark:text-cream">
              Journal des 14 derniers jours
            </h2>
          </div>
          <span className="text-[11px] text-ink/52 dark:text-champagne/72">
            1 seule écoute / jour
          </span>
        </div>

        <div className="mt-4 grid grid-cols-7 gap-2">
          {journal14.map((day) => {
            const d = new Date(day.date + 'T12:00:00')
            const label = d.toLocaleDateString('fr-FR', { weekday: 'narrow' })
            const num = d.getDate()
            const isToday = day.date === todayKey
            return (
              <div
                key={day.date}
                title={`${day.date}${day.completed ? ' — séance faite' : ''}`}
                className={cn(
                  'flex aspect-[3/4] flex-col items-center justify-center rounded-xl border text-[10px]',
                  day.completed
                    ? 'border-olive/40 bg-olive/15 text-cream'
                    : 'border-black/8 bg-black/[0.02] text-ink/62 dark:border-white/10 dark:bg-white/[0.03] dark:text-champagne/82',
                )}
              >
                <span className="opacity-70">{label}</span>
                <span className="mt-0.5 text-xs font-medium">{num}</span>
                {isToday && (
                  <span className="mt-1 h-1 w-1 rounded-full bg-ink dark:bg-cream" />
                )}
              </div>
            )
          })}
        </div>
      </Card>

      <Card className="w-full !p-5 text-left">
        <div className="flex items-center gap-2">
          <HelpCircle size={16} strokeWidth={1.75} className="text-ink/68 dark:text-champagne/86" />
          <h2 className="text-sm font-semibold text-ink dark:text-cream">
            Pourquoi la régularité quotidienne ?
          </h2>
        </div>
        <div className="mt-4 space-y-4 text-sm leading-relaxed text-ink/72 dark:text-champagne/88">
          <p>
            <span className="font-semibold text-ink dark:text-cream">La gravure neuronale : </span>
            Chaque séance d&apos;imagerie mentale trace des connexions. La répétition quotidienne
            grave cette nouvelle réalité dans ton cerveau.
          </p>
          <p>
            <span className="font-semibold text-ink dark:text-cream">
              La règle des 21/60 jours :{' '}
            </span>
            Selon le Dr Maxwell Maltz, 21 jours sont le minimum pour qu&apos;une nouvelle image
            mentale remplace une vieille habitude ; 60 jours pour un ancrage profond.
          </p>
          <p>
            <span className="font-semibold text-ink dark:text-cream">Le moment opportun : </span>
            Au réveil ou au coucher, le cerveau produit des ondes Alpha et Thêta — le
            subconscient est alors plus réceptif.
          </p>
        </div>
      </Card>

      {import.meta.env.DEV && (
        <div
          className={cn(
            'w-full rounded-2xl border border-dashed px-4 py-5 text-center',
            'border-black/15 bg-black/[0.02] dark:border-champagne/20 dark:bg-white/[0.03]',
          )}
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-olive">
            Zone de test de progression (simulateur)
          </p>
          <div className="mt-4 flex flex-col items-center gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
            <button
              type="button"
              onClick={() => runSim(21)}
              className="inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-full border border-black/10 bg-cream-soft px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-black/[0.06] dark:border-champagne/20 dark:bg-white/10 dark:text-cream dark:hover:bg-white/15 sm:w-auto"
            >
              <Plus size={15} />
              Simuler 21 jours d&apos;écoute
            </button>
            <button
              type="button"
              onClick={() => runSim(60)}
              className="inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-full border border-black/10 bg-cream-soft px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-black/[0.06] dark:border-champagne/20 dark:bg-white/10 dark:text-cream dark:hover:bg-white/15 sm:w-auto"
            >
              <Plus size={15} />
              Simuler 60 jours d&apos;écoute
            </button>
            <button
              type="button"
              onClick={resetProgress}
              className="inline-flex w-full max-w-xs items-center justify-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-400/30 dark:bg-red-500/15 dark:text-red-200 dark:hover:bg-red-500/25 sm:w-auto"
            >
              <RotateCcw size={15} />
              Réinitialiser
            </button>
          </div>
        </div>
      )}

      {popupDays !== null && (
        <MilestonePopup days={popupDays} onClose={() => setPopupDays(null)} />
      )}
    </div>
  )
}
