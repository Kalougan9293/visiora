import { PartyPopper } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export const MILESTONE_STEPS = [3, 7, 21, 30, 50, 60] as const

export type MilestoneDays = (typeof MILESTONE_STEPS)[number]

export const MILESTONE_POPUPS: Record<
  MilestoneDays,
  { headline: string; quote: string }
> = {
  3: {
    headline: '3 JOURS : LE PREMIER ÉLAN !',
    quote: 'Tu as allumé la flamme. Trois jours suffisent pour sentir que quelque chose commence.',
  },
  7: {
    headline: '7 JOURS : LA PREMIÈRE SEMAINE !',
    quote: 'Une semaine d’écoute. Le rituel s’installe — ton esprit reconnaît déjà le chemin.',
  },
  21: {
    headline: '21 JOURS : LA NOUVELLE IMAGE !',
    quote:
      'Tu as posé les fondations. Ta nouvelle image mentale commence à s’installer dans le quotidien.',
  },
  30: {
    headline: '30 JOURS : LE MOIS ANCRÉ !',
    quote: 'Un mois de constance. La visualisation n’est plus un essai — c’est une habitude vivante.',
  },
  50: {
    headline: '50 JOURS : LA TRAVERSÉE !',
    quote: 'Cinquante jours. Tu as traversé les doutes. La nouvelle réalité prend vraiment forme.',
  },
  60: {
    headline: "60 JOURS : L'ANCRAGE PROFOND !",
    quote:
      'La constance grave le changement. Chaque séance est une pierre posée pour sculpter ta nouvelle réalité.',
  },
}

export function MilestonePopup({
  days,
  onClose,
  variant = 'classic',
}: {
  days: MilestoneDays
  onClose: () => void
  variant?: 'classic' | 'aqua'
}) {
  const content = MILESTONE_POPUPS[days]
  const isAqua = variant === 'aqua'

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 px-5 backdrop-blur-[2px]"
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
          className={cn(
            'w-full max-w-sm rounded-[1.75rem] px-6 py-8 text-center shadow-2xl',
            isAqua
              ? 'border border-white/20 bg-[#0f4550] text-[#e8f7f9]'
              : 'bg-white text-ink dark:bg-ink-elevated dark:text-cream',
          )}
        >
          <div
            className={cn(
              'mx-auto flex h-14 w-14 items-center justify-center rounded-full',
              isAqua
                ? 'bg-white/10 text-[#7ed4df]'
                : 'bg-black/[0.05] text-olive dark:bg-white/10 dark:text-gold',
            )}
          >
            <PartyPopper size={26} strokeWidth={1.6} />
          </div>

          <h2
            id="milestone-title"
            className={cn(
              'mt-5 text-2xl font-semibold tracking-tight',
              isAqua ? 'text-[#e8f7f9]' : 'text-ink dark:text-cream',
            )}
            style={isAqua ? { fontFamily: 'var(--font-aqua-display)' } : undefined}
          >
            Palier Atteint !
          </h2>

          <p
            className={cn(
              'mt-2 text-sm',
              isAqua ? 'text-[#b8e4ea]' : 'text-ink/68 dark:text-champagne/86',
            )}
          >
            Tu viens de franchir un cap exceptionnel :
          </p>

          <p
            className={cn(
              'mt-4 text-sm font-bold uppercase tracking-wide',
              isAqua ? 'text-[#7ed4df]' : 'text-olive dark:text-gold',
            )}
          >
            {content.headline}
          </p>

          <p
            className={cn(
              'mt-5 text-sm italic leading-relaxed',
              isAqua ? 'text-[#b8e4ea]/85' : 'text-ink/68 dark:text-champagne/86',
            )}
          >
            « {content.quote} »
          </p>

          {isAqua ? (
            <button type="button" onClick={onClose} className="aqua-cta mt-7 w-full">
              <span>Continuer le voyage</span>
            </button>
          ) : (
            <Button className="mt-7 w-full rounded-full" onClick={onClose}>
              Continuer le voyage
            </Button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
