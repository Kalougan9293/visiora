import { Link } from 'react-router-dom'
import { ArrowRight, Brain, Sparkles, Trophy } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SCIENCE_CARDS } from '@/data/questionnaire'
import { HOME_COPY } from '@/data/uiCopy'
import { ScienceCarousel } from '@/components/home/ScienceCarousel'
import { LegalFooter } from '@/components/layout/LegalFooter'

const icons = {
  plasticite: Brain,
  champions: Trophy,
  methode: Sparkles,
} as const

export function HomePage() {
  return (
    <div className="flex flex-col items-center space-y-10 pb-6 md:space-y-14">
      <section className="relative flex w-full flex-col items-center pt-6 md:pt-10">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 flex w-full flex-col items-center"
        >
          <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-[var(--vs-azur)]/35 bg-[var(--vs-azur)]/10 px-3.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--vs-azur)] dark:border-[var(--vs-ardoise)] dark:bg-[var(--vs-abysse)] dark:text-[var(--vs-texte-faible)]">
            {HOME_COPY.badge}
          </span>

          <h1 className="font-display text-[2.35rem] leading-[1.08] tracking-tight text-balance text-ink dark:text-cream md:text-5xl">
            {HOME_COPY.line1}
            <br />
            {HOME_COPY.line2}
            <br />
            <span className="vs-titre-accent">{HOME_COPY.line3}</span>
          </h1>

          <p className="mt-5 max-w-lg text-sm leading-relaxed text-ink/82 dark:text-cream/92 md:text-base">
            {HOME_COPY.intro}
          </p>

          <div className="mt-8 w-full max-w-sm">
            <Link to="/creer" className="block">
              <Button size="lg" className="w-full rounded-full">
                {HOME_COPY.cta}
                <ArrowRight size={18} />
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      <ScienceSection />
      <LegalFooter />
    </div>
  )
}

function ScienceSection() {
  return (
    <section id="fondements" className="w-full scroll-mt-24">
      <h2 className="mb-6 text-[11px] font-medium uppercase tracking-[0.28em] text-ink/88 dark:text-cream/94 md:mb-8 md:text-xs">
        {HOME_COPY.section}
      </h2>

      <div className="md:hidden -mx-5">
        <ScienceCarousel />
      </div>

      <div className="hidden md:grid md:grid-cols-3 md:gap-4">
        {SCIENCE_CARDS.map((card, i) => {
          const Icon = icons[card.id as keyof typeof icons]
          return (
            <Card
              key={card.id}
              interactive
              className="group relative h-full overflow-hidden !p-6"
            >
              <div className="mb-4 flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--vs-azur)]/15 text-[var(--vs-azur)]">
                  <Icon size={22} strokeWidth={1.75} />
                </div>
                <span className="font-display text-3xl text-[var(--vs-azur)]/70">
                  0{i + 1}
                </span>
              </div>
              <h3 className="font-medium leading-snug text-ink dark:text-cream">{card.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink/82 dark:text-cream/90">
                {card.body}
              </p>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
