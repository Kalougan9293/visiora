import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Mic, MicOff, Pause, Play } from 'lucide-react'
import { AquaBubbles } from '@/components/aqua/AquaBubbles'
import {
  AQUA_VOICES,
  WIZARD_STEPS,
  AQUA_FIELD_PLACEHOLDERS,
  type WizardField,
} from '@/data/wizard'
import { useSessions } from '@/context/SessionsContext'
import { cn } from '@/lib/utils'
import { holdAmbiance, releaseAmbiance, type AmbianceId } from '@/services/ambiance'

type Answers = Record<string, string>

const INSPIRING_LINES = [
  'Pour combattre le stress…',
  'Pour mieux dormir…',
  'Pour performer en compétition…',
  'Pour réussir un entretien…',
  'Pour renforcer ta confiance…',
  'Pour retrouver du focus…',
] as const

export function AquaCreatePage() {
  const navigate = useNavigate()
  const { addSession } = useSessions()
  const [phase, setPhase] = useState<'intro' | 'wizard'>('intro')
  const [stepIdx, setStepIdx] = useState(0)
  const [answers, setAnswers] = useState<Answers>({
    q12_voice: 'rituel',
    q12_tutoiement: 'tu',
    q12_registre: 'neutre',
  })
  const [listeningField, setListeningField] = useState<string | null>(null)
  const [inspireIndex, setInspireIndex] = useState(0)
  const recognitionRef = useRef<{ stop: () => void } | null>(null)

  useEffect(() => {
    if (phase !== 'intro') return
    const id = window.setInterval(() => {
      setInspireIndex((i) => (i + 1) % INSPIRING_LINES.length)
    }, 3200)
    return () => window.clearInterval(id)
  }, [phase])

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

  const appendField = (id: string, chunk: string) => {
    setAnswers((prev) => ({
      ...prev,
      [id]: prev[id] ? `${prev[id].trim()} ${chunk}` : chunk,
    }))
  }

  const toggleMic = (fieldId: string) => {
    const W = window as Window & {
      SpeechRecognition?: new () => {
        lang: string
        interimResults: boolean
        continuous: boolean
        start: () => void
        stop: () => void
        onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null
        onerror: (() => void) | null
        onend: (() => void) | null
      }
      webkitSpeechRecognition?: new () => {
        lang: string
        interimResults: boolean
        continuous: boolean
        start: () => void
        stop: () => void
        onresult: ((e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null
        onerror: (() => void) | null
        onend: (() => void) | null
      }
    }
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition

    if (!SR) {
      alert('La saisie vocale n’est pas supportée sur ce navigateur.')
      return
    }

    if (listeningField === fieldId && recognitionRef.current) {
      recognitionRef.current.stop()
      setListeningField(null)
      return
    }

    recognitionRef.current?.stop()

    const rec = new SR()
    recognitionRef.current = rec
    rec.lang = 'fr-FR'
    rec.interimResults = false
    rec.continuous = false
    rec.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript
      if (text) appendField(fieldId, text)
    }
    rec.onerror = () => setListeningField(null)
    rec.onend = () => setListeningField(null)
    setListeningField(fieldId)
    rec.start()
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
      <div className="relative flex h-full min-h-0 flex-1 flex-col items-center overflow-hidden px-4 pb-2 pt-6 text-center sm:pt-8">
        <AquaBubbles density="soft" />

        <div className="relative z-10 flex max-w-sm shrink-0 flex-col items-center">
          <h1
            className="text-[2rem] leading-snug text-[#e8f7f9] sm:text-[2.35rem]"
            style={{ fontFamily: 'var(--font-aqua-display)' }}
          >
            Démarrer votre expérience
          </h1>
          <p
            className="mt-[3lh] text-[0.95rem] leading-relaxed text-[#e8f7f9]/90 sm:text-base"
            style={{ fontFamily: 'var(--font-aqua-sans)' }}
          >
            Chaque besoin et chaque personne sont différents. En quelques questions, Visiora
            compose une séance d&apos;imagerie mentale faite pour vous — pas un script générique.
          </p>
        </div>

        <div className="relative z-10 flex w-full max-w-sm flex-1 flex-col items-center justify-center py-2">
          <button
            type="button"
            onClick={() => setPhase('wizard')}
            className="aqua-cta aqua-cta-hero w-full max-w-[16rem] sm:max-w-[17rem]"
          >
            <span>
              Commencer
              <ArrowRight size={18} />
            </span>
          </button>
        </div>

        <div className="relative z-10 mb-2 flex h-10 w-full max-w-sm shrink-0 items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={inspireIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-x-0 text-[0.95rem] italic text-[#7ed4df]"
              style={{ fontFamily: 'var(--font-aqua-display)' }}
            >
              {INSPIRING_LINES[inspireIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-lg flex-1 flex-col items-center text-center">
      <div className="mb-2 flex w-full shrink-0 items-center justify-between text-[10px] font-semibold uppercase tracking-[0.16em] text-[#b8e4ea]">
        <span>
          Étape {step.step} de {step.total}
        </span>
        <span>{step.percent}% complété</span>
      </div>
      <div className="mb-3 h-1.5 w-full shrink-0 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#3db8c5] to-[#e8f7f9]"
          initial={false}
          animate={{ width: `${step.percent}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 28 }}
        />
      </div>

      <div className="flex min-h-0 w-full flex-1 flex-col justify-center overflow-y-auto py-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={step.step}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full"
          >
            <h1
              className="text-2xl text-[#e8f7f9] sm:text-3xl"
              style={{ fontFamily: 'var(--font-aqua-display)' }}
            >
              {step.title}
            </h1>
            <p className="mt-2 text-sm text-[#b8e4ea]">{step.subtitle}</p>
            {step.step === 1 && (
              <p className="mt-1.5 text-xs italic text-[#b8e4ea]/65">
                Tout est strictement anonyme, lâchez-vous dans vos réponses
              </p>
            )}

            <div className="mt-5 space-y-4">
              {step.fields.map((field) => (
                <AquaField
                  key={field.id}
                  field={field}
                  value={answers[field.id] ?? ''}
                  onChange={(v) => setField(field.id, v)}
                  answers={answers}
                  setField={setField}
                  listening={listeningField === field.id}
                  onMic={() => toggleMic(field.id)}
                  placeholder={
                    AQUA_FIELD_PLACEHOLDERS[field.id] ?? field.placeholder
                  }
                />
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-auto flex w-full shrink-0 gap-2 pt-3 pb-1">
        <button
          type="button"
          onClick={goBack}
          className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/20 py-3 text-sm font-medium text-[#e8f7f9] transition-colors hover:bg-white/10"
        >
          <ArrowLeft size={16} />
          Retour
        </button>
        <button
          type="button"
          disabled={!canContinue}
          onClick={goNext}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#e8f7f9] py-3 text-sm font-semibold text-[#0d3d47] transition-opacity disabled:opacity-40"
        >
          {stepIdx === WIZARD_STEPS.length - 1 ? 'Générer' : 'Suivant'}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}

function AquaField({
  field,
  value,
  onChange,
  answers,
  setField,
  listening,
  onMic,
  placeholder,
}: {
  field: WizardField
  value: string
  onChange: (v: string) => void
  answers: Answers
  setField: (id: string, v: string) => void
  listening: boolean
  onMic: () => void
  placeholder?: string
}) {
  const [focused, setFocused] = useState(false)
  const inputClass = cn(
    'mt-2 w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-center text-sm text-[#e8f7f9] placeholder:text-[#b8e4ea]/50',
    focused && 'aqua-field-lit',
  )

  if (field.type === 'voice') {
    return (
      <AquaVoiceChoice
        fieldLabel={field.label}
        value={answers.q12_voice}
        onChange={(id) => setField('q12_voice', id)}
      />
    )
  }

  if (field.type === 'choice-row') {
    return (
      <div className="w-full">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7ed4df]">
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
                    ? 'border-[#e8f7f9] bg-[#e8f7f9] text-[#0d3d47]'
                    : 'border-white/20 bg-white/5 text-[#e8f7f9]',
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
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7ed4df]">
        {field.label}
      </p>
      {field.hint && (
        <p className="mt-1.5 text-xs italic leading-relaxed text-[#b8e4ea]/80">
          {field.hint}
        </p>
      )}
      {field.badge && (
        <span className="mt-1.5 inline-block rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] text-[#b8e4ea]">
          {field.badge}
        </span>
      )}

      <div className="relative mt-2">
        {field.type === 'textarea' ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder ?? field.placeholder}
            rows={4}
            className={cn(inputClass, 'resize-none pr-11')}
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder ?? field.placeholder}
            className={cn(inputClass, 'pr-11')}
          />
        )}
        <button
          type="button"
          onClick={onMic}
          aria-label={listening ? 'Arrêter le micro' : 'Dicter au micro'}
          className={cn(
            'absolute right-2.5 flex h-7 w-7 items-center justify-center rounded-full leading-none transition-all',
            field.type === 'textarea' ? 'top-3.5' : 'inset-y-0 my-auto',
            listening
              ? 'bg-[#7ed4df] text-[#0d3d47] shadow-[0_0_16px_rgba(126,212,223,0.5)]'
              : 'bg-white/10 text-[#7ed4df] hover:bg-white/20',
          )}
        >
          {listening ? (
            <MicOff size={13} strokeWidth={2.25} className="block translate-y-px" />
          ) : (
            <Mic size={13} strokeWidth={2.25} className="block translate-y-px" />
          )}
        </button>
      </div>
    </div>
  )
}

function AquaVoiceChoice({
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
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7ed4df]">
        {fieldLabel}
      </p>
      <p className="mt-1 text-xs text-[#b8e4ea]">
        Chaque voix inclut son fond. Écoute, puis choisis :
      </p>
      <audio ref={audioRef} playsInline preload="none" onEnded={stopPreview} />
      <div className="mt-4 flex items-center justify-center gap-3 sm:gap-4">
        {AQUA_VOICES.map((v) => {
          const selected = value === v.id
          const playing = playingId === v.id
          return (
            <div
              key={v.id}
              className={cn(
                'relative h-24 w-24 shrink-0 overflow-hidden rounded-xl transition-all sm:h-28 sm:w-28',
                selected
                  ? 'ring-2 ring-[#7ed4df] shadow-[0_0_16px_rgba(126,212,223,0.35)]'
                  : 'ring-1 ring-white/15',
              )}
            >
              <button
                type="button"
                onClick={() => onChange(v.id)}
                aria-label={`${v.label} — fond ${v.vibe}`}
                className="absolute inset-0"
              >
                <span
                  className="absolute inset-0 bg-gradient-to-br from-[#1a6b78] to-[#0d3d47]"
                  aria-hidden
                />
                <img
                  src={v.photo}
                  alt=""
                  className="relative h-full w-full object-cover"
                  style={{ objectPosition: v.objectPosition }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </button>
              <button
                type="button"
                onClick={() => void togglePreview(v.id, v.preview, v.ambiance)}
                aria-label={playing ? `Arrêter ${v.label}` : `Écouter ${v.label}`}
                className={cn(
                  'absolute bottom-2 left-1/2 z-10 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full backdrop-blur-sm',
                  playing ? 'bg-[#7ed4df] text-[#0d3d47]' : 'bg-black/45 text-[#7ed4df]',
                )}
              >
                {playing ? (
                  <Pause size={11} className="fill-current" />
                ) : (
                  <Play size={11} className="fill-current" />
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

