import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  MILESTONE_STEPS,
  MilestonePopup,
  type MilestoneDays,
} from '@/components/progress/MilestonePopup'
import { useSessions } from '@/context/SessionsContext'
import { cn } from '@/lib/utils'

const FINAL_MILESTONE = MILESTONE_STEPS[MILESTONE_STEPS.length - 1]

/** Remplissage 0→1 calé sur les paliers (chaque badge = une part égale). */
function milestoneFillPct(days: number): number {
  if (days <= 0) return 0
  if (days >= FINAL_MILESTONE) return 1

  let prev = 0
  for (let i = 0; i < MILESTONE_STEPS.length; i++) {
    const curr = MILESTONE_STEPS[i]
    if (days <= curr) {
      const local = (days - prev) / (curr - prev)
      return (i + local) / MILESTONE_STEPS.length
    }
    prev = curr
  }
  return 1
}

function nextMilestone(days: number): number {
  return MILESTONE_STEPS.find((s) => s > days) ?? FINAL_MILESTONE
}

function TideRing({ days }: { days: number }) {
  const pct = milestoneFillPct(days)
  const next = nextMilestone(days)
  const r = 54
  const c = 2 * Math.PI * r
  const offset = c * (1 - pct)
  const done = days >= FINAL_MILESTONE

  return (
    <div className="relative flex h-40 w-40 shrink-0 items-center justify-center sm:h-44 sm:w-44">
      <div className="aqua-tide-halo absolute inset-0 rounded-full" />
      <svg width="160" height="160" viewBox="0 0 160 160" className="-rotate-90">
        <circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="8"
        />
        <motion.circle
          cx="80"
          cy="80"
          r={r}
          fill="none"
          stroke="url(#tideGrad)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
        <defs>
          <linearGradient id="tideGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7ed4df" />
            <stop offset="55%" stopColor="#e8f7f9" />
            <stop offset="100%" stopColor="#3db8c5" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p
          className="text-4xl leading-none text-[#e8f7f9]"
          style={{ fontFamily: 'var(--font-aqua-display)' }}
        >
          {days}
        </p>
        <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[#7ed4df]" style={{ fontFamily: 'var(--font-aqua-sans)' }}>
          {done ? 'palier final' : `/ ${next} jours`}
        </p>
      </div>
    </div>
  )
}

/** Une seule ligne pleine largeur : libellé unique dans la bulle (ex. 3j). */
function MilestonePath({ progressDays }: { progressDays: number }) {
  return (
    <div className="mt-7 w-full">
      <p
        className="mb-4 text-center text-base text-[#e8f7f9]"
        style={{ fontFamily: 'var(--font-aqua-display)' }}
      >
        Parcours des badges
      </p>

      <div className="flex w-full items-center">
        {MILESTONE_STEPS.map((step, i) => {
          const prev = i === 0 ? 0 : MILESTONE_STEPS[i - 1]
          const reached = progressDays >= step
          const isNext = !reached && progressDays >= prev
          return (
            <div key={step} className="flex min-w-0 flex-1 items-center">
              {i > 0 && (
                <span
                  className={cn(
                    'shrink-0 px-0.5 text-[10px] sm:px-1 sm:text-sm',
                    progressDays >= step ? 'text-[#7ed4df]' : 'text-white/30',
                  )}
                  aria-hidden
                >
                  →
                </span>
              )}
              <div className="flex flex-1 justify-center">
                <span
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full border-2 text-[11px] font-bold tabular-nums transition-all sm:h-11 sm:w-11 sm:text-xs',
                    reached
                      ? 'border-[#7ed4df] bg-[#7ed4df] text-[#0d3d47] shadow-[0_0_14px_rgba(126,212,223,0.45)]'
                      : isNext
                        ? 'border-[#7ed4df]/55 bg-white/10 text-[#e8f7f9]'
                        : 'border-white/25 bg-[#0d3d47] text-[#b8e4ea]/45',
                  )}
                  style={{ fontFamily: 'var(--font-aqua-sans)' }}
                >
                  {reached ? '✓' : `${step}j`}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function AquaProgressPage() {
  const { stats, simulateProgress, resetProgress } = useSessions()
  const { totalListens, daysCompletedTowardMilestone, journal } = stats
  const [popupDays, setPopupDays] = useState<MilestoneDays | null>(null)

  const journal14 = journal.slice(-14)
  const todayKey = new Date().toISOString().slice(0, 10)
  const progressDays = Math.max(totalListens, daysCompletedTowardMilestone)

  const runSim = (days: MilestoneDays) => {
    simulateProgress(days)
    setPopupDays(days)
  }

  return (
    <div className="relative mx-auto flex w-full max-w-lg flex-col items-center overflow-hidden pb-6 pt-2 text-center">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex w-full flex-col items-center"
      >
        <h1
          className="text-[2rem] leading-tight text-[#e8f7f9] sm:text-[2.35rem]"
          style={{ fontFamily: 'var(--font-aqua-display)' }}
        >
          Suivi
        </h1>
        <p
          className="mt-2 max-w-xs text-sm leading-relaxed text-[#b8e4ea]/90"
          style={{ fontFamily: 'var(--font-aqua-sans)' }}
        >
          La constance façonne la réalité. Un jour à la fois.
        </p>

        <div className="mt-8 flex w-full items-center justify-center gap-5 sm:gap-8">
          <TideRing days={progressDays} />

          <div className="flex flex-col items-center justify-center">
            <p
              className="text-4xl leading-none text-[#e8f7f9]"
              style={{ fontFamily: 'var(--font-aqua-display)' }}
            >
              {totalListens}
            </p>
            <p
              className="mt-1 text-[11px] uppercase tracking-[0.16em] text-[#7ed4df]"
              style={{ fontFamily: 'var(--font-aqua-sans)' }}
            >
              écoutes
            </p>
          </div>
        </div>

        <MilestonePath progressDays={progressDays} />

        <div className="mt-9 w-full">
          <div className="mb-4 flex items-baseline justify-center gap-2">
            <h2
              className="text-base text-[#e8f7f9]"
              style={{ fontFamily: 'var(--font-aqua-display)' }}
            >
              Dernières écoutes
            </h2>
            <span
              className="text-[11px] text-[#b8e4ea]/55"
              style={{ fontFamily: 'var(--font-aqua-sans)' }}
            >
              14 jours
            </span>
          </div>

          <div className="grid grid-cols-7 gap-x-1 gap-y-3 px-0 sm:gap-x-2">
            {journal14.map((day, i) => {
              const d = new Date(day.date + 'T12:00:00')
              const weekday = d
                .toLocaleDateString('fr-FR', { weekday: 'short' })
                .replace('.', '')
              const dayNum = d.getDate()
              const isToday = day.date === todayKey
              return (
                <motion.div
                  key={day.date}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.03 * i, duration: 0.4 }}
                  className="flex flex-col items-center gap-1.5"
                  title={`${day.date}${day.completed ? ' — séance faite' : ''}`}
                >
                  <span
                    className={cn(
                      'block rounded-full transition-all',
                      isToday
                        ? 'h-3.5 w-3.5 bg-white shadow-[0_0_14px_rgba(255,255,255,0.55)]'
                        : day.completed
                          ? 'h-3.5 w-3.5 bg-[#7ed4df] shadow-[0_0_12px_rgba(126,212,223,0.55)]'
                          : 'h-2.5 w-2.5 bg-white/25',
                    )}
                  />
                  <span
                    className={cn(
                      'text-[10px] capitalize leading-none',
                      isToday ? 'text-[#e8f7f9]' : 'text-[#b8e4ea]/70',
                    )}
                    style={{ fontFamily: 'var(--font-aqua-sans)' }}
                  >
                    {weekday}
                  </span>
                  <span
                    className={cn(
                      'text-xs font-semibold tabular-nums leading-none',
                      isToday ? 'text-white' : 'text-[#e8f7f9]/90',
                    )}
                    style={{ fontFamily: 'var(--font-aqua-sans)' }}
                  >
                    {dayNum}
                  </span>
                </motion.div>
              )
            })}
          </div>
        </div>

        {/* Zone test — hors champ produit, pliée par défaut */}
        <details className="mt-12 w-full max-w-sm opacity-40 open:opacity-70 transition-opacity">
          <summary
            className="cursor-pointer select-none text-center text-[10px] uppercase tracking-[0.2em] text-[#b8e4ea]/80"
            style={{ fontFamily: 'var(--font-aqua-sans)' }}
          >
            Dev · simuler
          </summary>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
            {MILESTONE_STEPS.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => runSim(days)}
                className="rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-[#e8f7f9]/90 transition-colors hover:bg-white/10"
                style={{ fontFamily: 'var(--font-aqua-sans)' }}
              >
                {days}j
              </button>
            ))}
            <button
              type="button"
              onClick={resetProgress}
              className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-[#b8e4ea]/80 transition-colors hover:bg-white/10"
              style={{ fontFamily: 'var(--font-aqua-sans)' }}
            >
              Reset
            </button>
          </div>
        </details>
      </motion.div>

      {popupDays !== null && (
        <MilestonePopup
          days={popupDays}
          variant="aqua"
          onClose={() => setPopupDays(null)}
        />
      )}
    </div>
  )
}
