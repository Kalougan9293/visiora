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
          <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-black/12 bg-black/[0.04] px-3.5 py-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-ink/75 dark:border-champagne/15 dark:bg-white/5 dark:text-champagne/88">
            <Sparkles size={12} className="text-gold" />
            Mental Imagerie IA
          </span>

          <h1 className="font-display text-[2.35rem] leading-[1.08] tracking-tight text-balance text-ink dark:text-cream md:text-5xl">
            Visualisez.
            <br />
            Ressentez.
            <br />
            <span className="italic text-olive dark:text-gold-bright">Façonnez votre réalité.</span>
          </h1>

          <p className="mt-5 max-w-lg text-sm leading-relaxed text-ink/70 dark:text-cream/80 md:text-base">
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
          className="pointer-events-none absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 rounded-full bg-gold/12 blur-3xl dark:bg-gold/18"
        />
      </section>

      <ScienceSection />
    </div>
  )
}

function ScienceSection() {
  return (
    <section id="science" className="w-full scroll-mt-24">
      <h2 className="mb-6 text-[11px] font-medium uppercase tracking-[0.28em] text-ink/80 dark:text-cream/85 md:mb-8 md:text-xs">
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
              className="group relative h-full overflow-hidden texture-paper !p-6 transition-all duration-500 hover:-translate-y-1"
            >
              <div
                aria-hidden
                className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
              />
              <div className="mb-4 flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/12 text-gold transition-transform duration-500 group-hover:scale-110">
                  <Icon size={22} strokeWidth={1.75} />
                </div>
                <span className="font-display text-3xl text-ink/50 transition-colors group-hover:text-ink/70 dark:text-gold-bright/70 dark:group-hover:text-gold-bright">
                  0{i + 1}
                </span>
              </div>
              <h3 className="font-medium leading-snug text-ink dark:text-cream">{card.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink/70 dark:text-cream/78">
                {card.body}
              </p>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
