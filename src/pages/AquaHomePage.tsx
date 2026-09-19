import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Play, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { AquaBubbles } from '@/components/aqua/AquaBubbles'

const POPUPS = [
  {
    n: '01',
    title: 'Plasticité Cérébrale',
    body: 'Imaginer une action active les mêmes réseaux que la réaliser. Répéter, c’est renforcer de vraies connexions.',
  },
  {
    n: '02',
    title: 'Techniques des Champions',
    body: 'Astronautes et olympiens visualisent pour ancrer la réussite — et couper l’anxiété avant l’action.',
  },
  {
    n: '03',
    title: 'Méthode rigoureuse',
    body: 'Chaque script Visiora : 7 mouvements, du tutoiement d’induction aux affirmations au « je ».',
  },
]

export function AquaHomePage() {
  const [videoOpen, setVideoOpen] = useState(false)
  const [ritualOpen, setRitualOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const anyOpen = videoOpen || ritualOpen
    if (!anyOpen) {
      const el = videoRef.current
      if (el) {
        el.pause()
        el.currentTime = 0
      }
      return
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setVideoOpen(false)
        setRitualOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'

    if (videoOpen) {
      const el = videoRef.current
      if (el) {
        el.muted = false
        el.volume = 1
        void el.play().catch(() => {
          /* certains navigateurs bloquent encore — l’utilisateur peut appuyer Play */
        })
      }
    }

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [videoOpen, ritualOpen])

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden">
      {!videoOpen && <AquaBubbles />}

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
        className="aqua-home-tight relative z-10 mx-auto flex h-full min-h-0 w-full max-w-2xl flex-1 flex-col items-center justify-evenly px-5 py-2 sm:max-w-3xl sm:px-10 sm:py-4"
      >
        <div className="flex w-full flex-col items-center">
          <h1
            className="w-full text-[1.85rem] leading-[1.4] tracking-tight text-balance text-[#f4fcfd] sm:text-[2.15rem] sm:leading-[1.45]"
            style={{ fontFamily: 'var(--font-aqua-display)', fontWeight: 450 }}
          >
            Visualisez.
            <br />
            Ressentez.
          </h1>

          <p
            className="aqua-title-gradient mt-4 text-[1.4rem] italic leading-snug sm:mt-5 sm:text-[1.7rem]"
            style={{ fontFamily: 'var(--font-aqua-display)', fontWeight: 450 }}
          >
            Façonnez votre réalité.
          </p>

          <p
            className="aqua-home-lead mt-6 max-w-sm text-[0.88rem] leading-[1.6] text-[#e8f7f9]/95 sm:mt-8 sm:max-w-md sm:text-[0.95rem]"
            style={{ fontFamily: 'var(--font-aqua-sans)' }}
          >
            Créez en quelques instants votre séance d&apos;imagerie mentale personnalisée.
            Objectifs sportifs, pro ou perso — une immersion guidée de 15 minutes, conçue pour
            votre esprit.
          </p>
        </div>

        <Link to="/creer" className="block w-full max-w-xs shrink-0">
          <span className="aqua-cta aqua-cta-hero">
            <span>
              Créer ma visualisation
              <ArrowRight size={17} />
            </span>
          </span>
        </Link>

        <div className="flex w-full shrink-0 flex-col items-center gap-4">
          <button
            type="button"
            onClick={() => setVideoOpen(true)}
            className="group relative block aspect-[3/4] w-[42%] max-w-[160px] overflow-hidden rounded-2xl border border-white/20 bg-[#0a333b] shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition-shadow duration-300 hover:shadow-[0_12px_28px_rgba(0,0,0,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7ed4df]/60 sm:max-w-[180px]"
            aria-label="Lire la vidéo"
          >
            <video
              src="/rituel.mp4"
              muted
              playsInline
              preload="metadata"
              className="pointer-events-none absolute inset-0 h-full w-full object-cover [transform:translateZ(0)]"
            />
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm transition-transform duration-300 group-hover:scale-105">
                <Play size={18} className="ml-0.5 fill-white" />
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setRitualOpen(true)}
            className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#d0eef2] transition-colors hover:text-white sm:text-xs"
            style={{ fontFamily: 'var(--font-aqua-sans)' }}
          >
            Découvrir le rituel
          </button>
        </div>
      </motion.section>

      <AnimatePresence>
        {videoOpen && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              aria-label="Fermer"
              className="absolute inset-0 bg-[#06262c]/75 backdrop-blur-sm"
              onClick={() => setVideoOpen(false)}
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 w-full max-w-sm overflow-hidden rounded-[1.5rem] border border-white/20 bg-black shadow-2xl sm:max-w-md"
            >
              <button
                type="button"
                onClick={() => setVideoOpen(false)}
                className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-black/40 text-white backdrop-blur-sm"
                aria-label="Fermer"
              >
                <X size={16} />
              </button>

              <div className="aspect-[3/4] w-full bg-black">
                <video
                  ref={videoRef}
                  src="/rituel.mp4"
                  className="h-full w-full object-cover [transform:translateZ(0)]"
                  controls
                  playsInline
                  autoPlay
                  loop
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3 popups concept — clic sur le titre */}
      <AnimatePresence>
        {ritualOpen && (
          <motion.div
            className="fixed inset-0 z-[80] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <button
              type="button"
              aria-label="Fermer"
              className="absolute inset-0 bg-[#06262c]/7 backdrop-blur-sm"
              onClick={() => setRitualOpen(false)}
            />

            <div className="relative z-10 flex w-full max-w-md flex-col gap-3">
              {POPUPS.map((item, i) => (
                <motion.div
                  key={item.n}
                  role="dialog"
                  aria-modal="true"
                  initial={{ opacity: 0, y: 28, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 12, scale: 0.98 }}
                  transition={{
                    delay: 0.06 + i * 0.1,
                    duration: 0.4,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="aqua-glass rounded-2xl px-5 py-4 text-center shadow-xl"
                >
                  <p className="text-[10px] font-semibold tracking-[0.22em] text-[#7ed4df]">
                    {item.n}
                  </p>
                  <h3
                    className="mt-1 text-lg text-white"
                    style={{ fontFamily: 'var(--font-aqua-display)' }}
                  >
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-snug text-[#e8f7f9]/95">{item.body}</p>
                </motion.div>
              ))}

              <button
                type="button"
                onClick={() => setRitualOpen(false)}
                className="mx-auto mt-1 flex h-9 w-9 items-center justify-center rounded-full border border-white/25 text-white/90 transition-colors hover:bg-white/10"
                aria-label="Fermer"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
