import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Compass, Pause, Play } from 'lucide-react'
import {
  CREATE_INTRO,
  VOICES,
  WIZARD_STEPS,
  type WizardField,
} from '@/data/wizard'
import { useSessions } from '@/context/SessionsContext'
import { useAuth } from '@/context/AuthContext'
import { AuthModal } from '@/components/auth/AuthModal'
import { HealthScreen } from '@/components/create/HealthScreen'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { AutoGrowTextarea } from '@/components/ui/AutoGrowTextarea'
import { cn } from '@/lib/utils'
import { holdAmbiance, releaseAmbiance, type AmbianceChoice } from '@/services/ambiance'
import { needsHealthScreen } from '@/services/healthGate'

type Answers = Record<string, string>

export function CreatePage() {
  const navigate = useNavigate()
  const { addSession } = useSessions()
  const { user } = useAuth()
  const [phase, setPhase] = useState<'intro' | 'wizard'>('intro')
  const [stepIdx, setStepIdx] = useState(0)
  const [authOpen, setAuthOpen] = useState(false)
  const [pendingStart, setPendingStart] = useState(false)
  const [answers, setAnswers] = useState<Answers>({
    q12_voice: 'rituel',
    q12_tutoiement: 'tu',
    q12_registre: 'neutre',
  })
  const [healthGate, setHealthGate] = useState(false)

  const step = WIZARD_STEPS[stepIdx]

  const canContinue = useMemo(() => {
    if (!step) return false
    return step.fields.every((f) => {
      if (f.optional) return true
      if (f.type === 'voice') return Boolean(answers.q12_voice)
      if (f.type === 'choice-row') return Boolean(answers[f.id])
      return Boolean(answers[f.id]?.trim())
    })
  }, [step, answers])

  const setField = (id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }))
  }

  const startWizard = () => {
    setPhase('wizard')
    setStepIdx(0)
  }

  const onStartClick = () => {
    if (!user) {
      setPendingStart(true)
      setAuthOpen(true)
      return
    }
    startWizard()
  }

  useEffect(() => {
    if (!user || !pendingStart) return
    setPendingStart(false)
    setAuthOpen(false)
    startWizard()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- enter wizard only after login
  }, [user, pendingStart])

  const goNext = () => {
    if (stepIdx < WIZARD_STEPS.length - 1) {
      const next = stepIdx + 1
      if (next === WIZARD_STEPS.length - 1 && needsHealthScreen(answers)) {
        setHealthGate(true)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      setStepIdx(next)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (needsHealthScreen(answers)) {
      setHealthGate(true)
      return
    }
    void addSession(answers).then(() => navigate('/bibliotheque'))
  }

  const acceptHealth = () => {
    setAnswers((prev) => ({
      ...prev,
      health_ack: '1',
      health_ack_at: new Date().toISOString(),
    }))
    setHealthGate(false)
    setStepIdx(WIZARD_STEPS.length - 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const goBack = () => {
    if (healthGate) {
      setHealthGate(false)
      return
    }
    if (stepIdx === 0) {
      setPhase('intro')
      return
    }
    setStepIdx((s) => s - 1)
  }

  if (phase === 'intro') {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col items-center overflow-y-auto pb-4 pt-2 text-center">
        <AuthModal
          open={authOpen}
          onClose={() => {
            setAuthOpen(false)
            setPendingStart(false)
          }}
        />
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-olive/10 dark:bg-olive/15">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-olive text-cream dark:text-ink">
            <Compass size={24} strokeWidth={1.75} />
          </div>
        </div>

        <h1 className="font-display text-3xl tracking-tight text-ink dark:text-cream sm:text-4xl">
          {CREATE_INTRO.title}
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-ink/82 dark:text-cream/92">
          {CREATE_INTRO.body}
        </p>

        <Card className="mt-8 w-full max-w-md !p-5 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-olive dark:text-olive">
            {CREATE_INTRO.detailsLabel}
          </p>
          <ul className="mx-auto mt-4 w-fit max-w-full space-y-2.5 text-left">
            {CREATE_INTRO.details.map((line) => (
              <li
                key={line}
                className="flex items-start gap-2 text-sm text-ink/82 dark:text-cream/90"
              >
                <Check size={16} className="mt-0.5 shrink-0 text-olive dark:text-olive" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Button
          size="lg"
          className="mt-8 w-full max-w-md rounded-full"
          onClick={onStartClick}
        >
          {CREATE_INTRO.cta}
          <ArrowRight size={18} />
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-xl flex-1 flex-col items-center text-center">
      <div className="mb-1.5 flex w-full shrink-0 items-center justify-between text-[11px] font-medium uppercase tracking-[0.14em] text-ink/50 dark:text-cream/50">
        <span>
          {healthGate ? 'Santé' : `Étape ${step.step} / ${step.total}`}
        </span>
        <span>{step.percent}%</span>
      </div>
      <ProgressBar value={step.percent} className="mb-2 shrink-0" />

      <div className="flex min-h-0 w-full flex-1 flex-col justify-center overflow-y-auto py-2">
        {healthGate ? (
          <HealthScreen onAccept={acceptHealth} />
        ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={step.step}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28 }}
            className="my-auto w-full"
          >
            <h1 className="font-display text-[1.7rem] leading-snug tracking-tight text-ink dark:text-cream sm:text-[1.95rem]">
              {step.title}
            </h1>
            <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed text-ink/65 dark:text-cream/70">
              {step.subtitle}
            </p>

            <div className="mt-5 space-y-4">
              {step.fields.map((field) => (
                <FieldBlock
                  key={field.id}
                  field={field}
                  value={answers[field.id] ?? ''}
                  onChange={(v) => setField(field.id, v)}
                  answers={answers}
                  setField={setField}
                />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
        )}
      </div>

      <div className="flex w-full shrink-0 gap-2.5 pt-3 pb-1">
        <Button variant="outline" className="flex-1 rounded-full !py-2.5 text-[15px]" onClick={goBack}>
          <ArrowLeft size={17} />
          Retour
        </Button>
        {!healthGate && (
        <Button className="flex-1 rounded-full !py-2.5 text-[15px]" disabled={!canContinue} onClick={goNext}>
          {stepIdx === WIZARD_STEPS.length - 1 ? 'Générer' : 'Suivant'}
          <ArrowRight size={17} />
        </Button>
        )}
      </div>
    </div>
  )
}

function FieldBlock({
  field,
  value,
  onChange,
  answers,
  setField,
}: {
  field: WizardField
  value: string
  onChange: (v: string) => void
  answers: Answers
  setField: (id: string, v: string) => void
}) {
  const inputClass = cn(
    'mt-2 w-full rounded-2xl border px-3.5 py-2.5 text-center text-base leading-relaxed outline-none transition',
    'border-black/[0.08] bg-white/70 text-ink placeholder:text-ink/35',
    'focus:border-olive/40 focus:ring-2 focus:ring-olive/10',
    'dark:border-white/10 dark:bg-white/[0.05] dark:text-cream dark:placeholder:text-cream/35 dark:focus:border-gold/30 dark:focus:ring-gold/10',
  )

  /** Étape 2 (scène) : un peu plus haute au départ ; le reste reste compact. */
  const growMinRows = field.id === 'q4' ? 4 : 2

  if (field.type === 'voice') {
    return (
      <VoiceChoice
        fieldLabel={field.label}
        value={answers.q12_voice}
        onChange={(id) => setField('q12_voice', id)}
      />
    )
  }

  if (field.type === 'choice-row') {
    return (
      <div className="w-full text-center">
        <p className="text-[14px] font-medium leading-snug text-ink/85 dark:text-cream/90">
          {field.label}
        </p>
        <div className="mt-2.5 flex flex-wrap justify-center gap-2">
          {field.choices?.map((c) => {
            const selected = value === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onChange(c.id)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all sm:text-[14px]',
                  selected
                    ? 'bg-olive text-cream dark:bg-gold dark:text-ink'
                    : 'bg-black/[0.04] text-ink/70 hover:bg-black/[0.07] dark:bg-white/[0.06] dark:text-cream/75 dark:hover:bg-white/10',
                )}
              >
                {c.label}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full text-center">
      <p className="text-[14px] font-medium leading-snug text-ink/85 dark:text-cream/90">
        {field.label}
      </p>
      {field.hint && (
        <p className="mx-auto mt-1.5 max-w-md text-[12px] leading-relaxed text-ink/50 dark:text-cream/50 sm:text-[13px]">
          {field.hint}
        </p>
      )}
      {field.type === 'textarea' ? (
        <AutoGrowTextarea
          value={value}
          onChange={onChange}
          placeholder={field.placeholder}
          minRows={growMinRows}
          className={inputClass}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={inputClass}
        />
      )}
    </div>
  )
}

function VoiceChoice({
  fieldLabel,
  value,
  onChange,
}: {
  fieldLabel: string
  value: string
  onChange: (id: string) => void
}) {
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    const el = audioRef.current
    return () => {
      el?.pause()
      releaseAmbiance()
    }
  }, [])

  const stopPreview = () => {
    const el = audioRef.current
    el?.pause()
    releaseAmbiance()
    setPlayingId(null)
  }

  const togglePreview = async (id: string, src: string, ambiance: AmbianceChoice) => {
    const el = audioRef.current
    if (!el) return
    onChange(id)
    if (playingId === id && !el.paused) {
      stopPreview()
      return
    }
    el.pause()
    releaseAmbiance()
    el.src = src
    // Vanessa : l'extrait MP3 contient déjà oiseaux+musique. La boucle Web Audio ajoutait un grésillement.
    if (ambiance && id !== 'rituel') holdAmbiance(ambiance)
    try {
      await el.play()
      setPlayingId(id)
    } catch {
      releaseAmbiance()
      setPlayingId(null)
    }
  }

  return (
    <div className="w-full text-center">
      <p className="text-[15px] font-medium leading-snug text-ink/85 dark:text-cream/90 sm:text-base">
        {fieldLabel}
      </p>
      <p className="mt-2 text-[13px] text-ink/50 dark:text-cream/50 sm:text-sm">Écoute, puis choisis</p>
      <audio ref={audioRef} playsInline preload="none" onEnded={stopPreview} />
      <div className="mt-4 flex flex-wrap justify-center gap-2.5">
        {VOICES.map((v) => {
          const selected = value === v.id
          const playing = playingId === v.id
          return (
            <div
              key={v.id}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full pl-4 pr-2 py-1.5 transition-all',
                selected
                  ? 'bg-olive text-cream dark:bg-gold dark:text-ink'
                  : 'bg-black/[0.04] text-ink/75 dark:bg-white/[0.06] dark:text-cream/80',
              )}
            >
              <button
                type="button"
                onClick={() => onChange(v.id)}
                className="text-[14px] font-semibold sm:text-[15px]"
              >
                {v.name}
              </button>
              <button
                type="button"
                onClick={() => void togglePreview(v.id, v.preview, v.ambiance)}
                aria-label={playing ? `Arrêter ${v.name}` : `Écouter ${v.name}`}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full transition',
                  selected
                    ? 'bg-white/20 dark:bg-ink/10'
                    : 'bg-olive/10 text-olive dark:bg-white/10 dark:text-cream/80',
                )}
              >
                {playing ? <Pause size={12} className="fill-current" /> : <Play size={12} className="fill-current" />}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
