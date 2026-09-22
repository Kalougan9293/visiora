import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Brain, Sparkles, Trophy } from 'lucide-react'
import { motion, useMotionValue, animate, type PanInfo } from 'framer-motion'
import { SCIENCE_CARDS } from '@/data/questionnaire'
import { HOME_COPY } from '@/data/uiCopy'
import { cn } from '@/lib/utils'

const icons = {
  plasticite: Brain,
  champions: Trophy,
  methode: Sparkles,
} as const

const GAP = 16

export function ScienceCarousel() {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const [cardW, setCardW] = useState(280)
  const [ready, setReady] = useState(false)
  const x = useMotionValue(0)

  const xForIndex = useCallback(
    (i: number) => {
      const vp = viewportRef.current
      if (!vp) return 0
      const margin = (vp.clientWidth - cardW) / 2
      return margin - i * (cardW + GAP)
    },
    [cardW],
  )

  useLayoutEffect(() => {
    const vp = viewportRef.current
    if (!vp) return
    const w = Math.min(300, Math.max(250, vp.clientWidth * 0.8))
    setCardW(w)
    setReady(true)
  }, [])

  useEffect(() => {
    const onResize = () => {
      const vp = viewportRef.current
      if (!vp) return
      setCardW(Math.min(300, Math.max(250, vp.clientWidth * 0.8)))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (!ready) return
    const controls = animate(x, xForIndex(index), {
      type: 'spring',
      stiffness: 260,
      damping: 30,
      mass: 0.8,
    })
    return controls.stop
  }, [index, x, xForIndex, ready, cardW])

  const minX = xForIndex(SCIENCE_CARDS.length - 1)
  const maxX = xForIndex(0)

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const velocity = info.velocity.x
    let next = index

    if (velocity < -450) next = Math.min(SCIENCE_CARDS.length - 1, index + 1)
    else if (velocity > 450) next = Math.max(0, index - 1)
    else {
      const projected = x.get() + velocity * 0.2
      let best = 0
      let bestDist = Infinity
      for (let i = 0; i < SCIENCE_CARDS.length; i++) {
        const dist = Math.abs(projected - xForIndex(i))
        if (dist < bestDist) {
          bestDist = dist
          best = i
        }
      }
      next = best
    }

    setIndex(next)
  }

  return (
    <div className="w-full">
      <div ref={viewportRef} className="relative w-full overflow-hidden py-1">
        <motion.div
          className="flex cursor-grab active:cursor-grabbing will-change-transform"
          style={{ x, gap: GAP, touchAction: 'none' }}
          drag="x"
          dragConstraints={{ left: minX - 40, right: maxX + 40 }}
          dragElastic={0.22}
          dragMomentum
          onDragEnd={onDragEnd}
        >
          {SCIENCE_CARDS.map((card, i) => {
            const Icon = icons[card.id as keyof typeof icons]
            const active = i === index
            return (
              <motion.div
                key={card.id}
                style={{ width: cardW, minWidth: cardW }}
                animate={{
                  scale: active ? 1 : 0.92,
                  opacity: active ? 1 : 0.5,
                }}
                transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                className="shrink-0"
              >
                <div
                  className={cn(
                    'flex h-full min-h-[210px] flex-col items-center justify-center rounded-2xl p-5 text-center',
                    'glass',
                    active && 'border-[var(--vs-azur)]',
                  )}
                >
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--vs-azur)]/15 text-[var(--vs-azur)]">
                    <Icon size={20} strokeWidth={1.75} />
                  </div>
                  <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.2em] text-[var(--vs-azur)]">
                    0{i + 1}
                  </p>
                  <h3 className="font-medium leading-snug text-ink dark:text-cream">
                    {card.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink/82 dark:text-cream/90">
                    {card.body}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </motion.div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2">
        {SCIENCE_CARDS.map((card, i) => (
          <button
            key={card.id}
            type="button"
            aria-label={`Carte ${i + 1}`}
            onClick={() => setIndex(i)}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              i === index
                ? 'w-6 bg-[var(--vs-azur)]'
                : 'w-1.5 bg-ink/20 hover:bg-ink/35 dark:bg-champagne/35',
            )}
          />
        ))}
      </div>
      <p className="mt-2 text-center text-[10px] uppercase tracking-[0.18em] text-ink/58 dark:text-champagne/86">
        {HOME_COPY.swipe}
      </p>
    </div>
  )
}
