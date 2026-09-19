import { Link } from 'react-router-dom'
import { ArrowRight, Brain, Sparkles, Trophy } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { SCIENCE_CARDS } from '@/data/questionnaire'
import { ScienceCarousel } from '@/components/home/ScienceCarousel'

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
          <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-olive/25 bg-olive/10 px-3.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-olive dark:border-[var(--vs-ardoise)] dark:bg-[var(--vs-abysse)] dark:text-[var(--vs-texte-faible)]">
            <Sparkles size={12} className="text-olive dark:text-[var(--vs-azur)]" />
            Mental Imagerie IA
          </span>

          <h1 className="font-display text-[2.35rem] leading-[1.08] tracking-tight text-balance text-ink dark:text-cream md:text-5xl">
            Visualisez.
            <br />
            Ressentez.
            <br />
            <span className="vs-titre-accent italic">Façonnez votre réalité.</span>
          </h1>

          <p className="mt-5 max-w-lg text-sm leading-relaxed text-ink/82 dark:text-cream/92 md:text-base">
            Créez en quelques instants votre séance d&apos;imagerie mentale personnalisée par
            intelligence artificielle. Atteignez vos objectifs sportifs, professionnels et
            personnels grâce à une immersion guidée de 15 minutes conçue sur mesure pour votre
            esprit.
          </p>

          <div className="mt-8 w-full max-w-sm">
            <Link to="/creer" className="block">
              <Button size="lg" className="w-full rounded-full">
                Créer ma visualisation
                <ArrowRight size={18} />
              </Button>
            </Link>
          </div>
        </motion.div>

        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 1.2 }}
          className="pointer-events-none absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 rounded-full bg-olive/10 blur-3xl dark:bg-[var(--vs-or)]/10"
        />
      </section>

      <ScienceSection />
    </div>
  )
}

function ScienceSection() {
  return (
    <section id="science" className="w-full scroll-mt-24">
      <h2 className="mb-6 text-[11px] font-medium uppercase tracking-[0.28em] text-ink/88 dark:text-cream/94 md:mb-8 md:text-xs">
        La science derrière la méthode
      </h2>

      {/* Mobile / tablette : carrousel glissable */}
      <div className="md:hidden -mx-5">
        <ScienceCarousel />
      </div>

      {/* Desktop : grille */}
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
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-olive/15 text-olive">
                  <Icon size={22} strokeWidth={1.75} />
                </div>
                <span className="font-display text-3xl text-olive/70">
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
