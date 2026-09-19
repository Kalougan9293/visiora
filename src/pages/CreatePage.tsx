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
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { cn } from '@/lib/utils'
import { holdAmbiance, releaseAmbiance, type AmbianceId } from '@/services/ambiance'

type Answers = Record<string, string>

export function CreatePage() {
  const navigate = useNavigate()
  const { addSession } = useSessions()
  const [phase, setPhase] = useState<'intro' | 'wizard'>('intro')
  const [stepIdx, setStepIdx] = useState(0)
  const [answers, setAnswers] = useState<Answers>({
    q12_voice: 'rituel',
    q12_tutoiement: 'tu',
    q12_registre: 'neutre',
  })

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

  const goNext = () => {
    if (stepIdx < WIZARD_STEPS.length - 1) {
      setStepIdx((s) => s + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      void addSession(answers).then(() => navigate('/bibliotheque'))
    }
  }

  const goBack = () => {
    if (stepIdx === 0) {
      setPhase('intro')
      return
    }
    setStepIdx((s) => s - 1)
  }

  if (phase === 'intro') {
    return (
      <div className="flex h-full min-h-0 flex-1 flex-col items-center overflow-y-auto pb-4 pt-2 text-center">
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
          onClick={() => setPhase('wizard')}
        >
          {CREATE_INTRO.cta}
          <ArrowRight size={18} />
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-1 flex-col items-center text-center">
      <div className="mb-2 flex w-full shrink-0 items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/62 dark:text-champagne/88">
        <span>
          Étape {step.step} de {step.total}
        </span>
        <span>{step.percent}% complété</span>
      </div>
      <ProgressBar value={step.percent} className="mb-3 shrink-0" />

      <div
        className={cn(
          'flex min-h-0 w-full flex-1 flex-col overflow-y-auto py-1',
          stepIdx === WIZARD_STEPS.length - 1 ? 'justify-start' : 'justify-center',
        )}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={step.step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            <h1 className="font-display text-2xl tracking-tight text-ink dark:text-cream sm:text-3xl">
              {step.title}
            </h1>
            <p className="mt-2 text-sm text-ink/72 dark:text-cream/88">{step.subtitle}</p>

            <div className={cn('mt-5', stepIdx === WIZARD_STEPS.length - 1 ? 'space-y-3' : 'space-y-4')}>
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
      </div>

      <div className="mt-auto flex w-full shrink-0 gap-2 pt-3 pb-1">
        <Button variant="outline" className="flex-1 rounded-full" onClick={goBack}>
          <ArrowLeft size={16} />
          Retour
        </Button>
        <Button className="flex-1 rounded-full" disabled={!canContinue} onClick={goNext}>
          {stepIdx === WIZARD_STEPS.length - 1 ? 'Générer' : 'Suivant'}
          <ArrowRight size={16} />
        </Button>
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
    'mt-2 w-full rounded-2xl border px-4 py-3 text-center text-sm outline-none transition-all',
    'border-black/10 bg-white/80 text-ink placeholder:text-ink/35',
    'focus:border-olive/50 focus:ring-2 focus:ring-olive/15',
    'dark:border-champagne/20 dark:bg-white/5 dark:text-cream dark:placeholder:text-champagne/40 dark:focus:border-olive/40',
  )

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
      <div className="w-full">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-olive dark:text-olive">
          {field.label}
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {field.choices?.map((c) => {
            const selected = value === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onChange(c.id)}
                className={cn(
                  'rounded-full border px-4 py-2 text-sm font-medium transition-all',
                  selected
                    ? 'border-olive bg-olive text-cream dark:text-ink'
                    : 'border-black/10 bg-white/70 text-ink dark:border-champagne/20 dark:bg-white/5 dark:text-cream',
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
    <div className="w-full">
      <div className="flex flex-col items-center gap-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-olive dark:text-olive">
          {field.label}
        </p>
        {field.hint && (
          <p className="max-w-md text-xs italic leading-relaxed text-ink/58 dark:text-champagne/82">
            {field.hint}
          </p>
        )}
        {field.badge && (
          <span className="rounded-full bg-black/[0.04] px-2.5 py-0.5 text-[10px] text-ink/62 dark:bg-white/5 dark:text-champagne/86">
            {field.badge}
          </span>
        )}
      </div>
      {field.type === 'textarea' ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={4}
          className={cn(inputClass, 'resize-none')}
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

  const togglePreview = async (id: string, src: string, ambiance: AmbianceId) => {
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
    holdAmbiance(ambiance)
    try {
      await el.play()
      setPlayingId(id)
    } catch {
      releaseAmbiance()
      setPlayingId(null)
    }
  }

  return (
    <div className="w-full">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-olive dark:text-olive">
        {fieldLabel}
      </p>
      <p className="mt-1 text-xs text-ink/68 dark:text-cream/82">
        Chaque voix inclut son fond. Écoute, puis choisis :
      </p>
      <audio
        ref={audioRef}
        playsInline
        preload="none"
        onEnded={stopPreview}
      />
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {VOICES.map((v) => {
          const selected = value === v.id
          const playing = playingId === v.id
          return (
            <div
              key={v.id}
              className={cn(
                'flex min-h-[4.5rem] flex-col items-center justify-center rounded-xl border px-1 py-1.5 text-center transition-all',
                selected
                  ? 'border-olive bg-olive text-cream dark:text-ink'
                  : 'border-black/10 bg-white/70 text-ink dark:border-champagne/20 dark:bg-white/5 dark:text-cream',
                'max-sm:last:col-span-2 max-sm:last:mx-auto max-sm:last:w-[calc(50%-0.25rem)]',
              )}
            >
              <button
                type="button"
                onClick={() => onChange(v.id)}
                className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-0.5"
              >
                <span className="text-sm font-semibold leading-tight">{v.name}</span>
                <span
                  className={cn(
                    'line-clamp-2 text-[10px] leading-tight',
                    selected ? 'text-cream/85 dark:text-ink/70' : 'text-ink/60 dark:text-cream/75',
                  )}
                >
                  {v.description}
                </span>
              </button>
              <button
                type="button"
                onClick={() => void togglePreview(v.id, v.preview, v.ambiance)}
                aria-label={playing ? `Arrêter ${v.name}` : `Écouter ${v.name}`}
                className={cn(
                  'mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full',
                  selected
                    ? 'bg-white/20 text-cream dark:bg-ink/15 dark:text-ink'
                    : 'bg-olive/10 text-olive dark:bg-olive/15 dark:text-olive',
                )}
              >
                {playing ? <Pause size={11} className="fill-current" /> : <Play size={11} className="fill-current" />}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
