import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'

export const MILESTONE_STEPS = [3, 7, 21, 30, 50, 60] as const

export type MilestoneDays = (typeof MILESTONE_STEPS)[number]

export const MILESTONE_POPUPS: Record<
  MilestoneDays,
  { headline: string; quote: string }
> = {
  3: {
    headline: '3 jours de pratique',
    quote: 'Trois jours sont posés. Le chemin est ouvert.',
  },
  7: {
    headline: '7 jours de pratique',
    quote: "Une semaine d'écoute. La pratique commence à prendre place.",
  },
  21: {
    headline: '21 jours de pratique',
    quote: "Trois semaines. Une nouvelle image de soi peut commencer à s'installer.",
  },
  30: {
    headline: '30 jours de pratique',
    quote: 'Un mois. La visualisation fait désormais partie de ton rythme.',
  },
  50: {
    headline: '50 jours de pratique',
    quote: 'Cinquante jours. La pratique est installée.',
  },
  60: {
    headline: '60 jours de pratique',
    quote:
      "Deux mois. C'est le temps dont parlent souvent les travaux sur les habitudes — avec de grandes variations d'une personne à l'autre.",
  },
}

export function MilestonePopup({ days, onClose }: { days: MilestoneDays; onClose: () => void }) {
  const content = MILESTONE_POPUPS[days]

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="milestone-title"
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm rounded-[1.75rem] border border-[var(--vs-bordure)] bg-[var(--vs-surface)] px-6 py-8 text-center text-ink dark:text-[var(--vs-lunaire)]"
        >
          <h2
            id="milestone-title"
            className="font-display text-2xl tracking-tight text-ink dark:text-[var(--vs-ecume)]"
          >
            Repère atteint
          </h2>

          <p className="mt-4 text-sm font-medium uppercase tracking-wide text-[var(--vs-azur)]">
            {content.headline}
          </p>

          <p className="mt-5 text-sm leading-relaxed text-ink/68 dark:text-[var(--vs-texte-faible)]">
            {content.quote}
          </p>

          <Button className="mt-7 w-full rounded-full" onClick={onClose}>
            Continuer
          </Button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
