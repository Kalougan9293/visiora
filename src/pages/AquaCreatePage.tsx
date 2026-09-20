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
import { useAuth } from '@/context/AuthContext'
import { AuthModal } from '@/components/auth/AuthModal'
import { cn } from '@/lib/utils'
import { holdAmbiance, releaseAmbiance, type AmbianceChoice } from '@/services/ambiance'
import { canDictate, startDictation, type DictationSession } from '@/services/dictation'

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
  const [listeningField, setListeningField] = useState<string | null>(null)
  const [micHint, setMicHint] = useState('')
  const [inspireIndex, setInspireIndex] = useState(0)
  const dictationRef = useRef<DictationSession | null>(null)

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

  const stopDictation = () => {
    dictationRef.current?.stop()
    dictationRef.current = null
    setListeningField(null)
  }

  const toggleMic = (fieldId: string) => {
    if (listeningField === fieldId) {
      stopDictation()
      setMicHint('')
      return
    }

    if (!canDictate()) {
      setMicHint('La dictée n’est pas dispo ici — essaie Chrome ou Safari.')
      return
    }

    stopDictation()
    setMicHint('Parle — tes mots s’écrivent.')
    setListeningField(fieldId)

    const session = startDictation({
      onTranscript: (text) => appendField(fieldId, text),
      onError: (message) => {
        if (dictationRef.current !== session) return
        setMicHint(message)
        setListeningField(null)
        dictationRef.current = null
      },
      onEnd: () => {
        if (dictationRef.current !== session) return
        setListeningField(null)
        dictationRef.current = null
      },
    })
    dictationRef.current = session
  }

  useEffect(() => {
    return () => dictationRef.current?.stop()
  }, [])

  useEffect(() => {
    stopDictation()
    setMicHint('')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stop the mic when changing step
  }, [stepIdx])

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
        <AuthModal
          open={authOpen}
          onClose={() => {
            setAuthOpen(false)
            setPendingStart(false)
          }}
        />
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
            onClick={onStartClick}
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
      <div className="mb-1.5 flex w-full shrink-0 items-center justify-between text-[10px] font-medium uppercase tracking-[0.14em] text-[#b8e4ea]/70">
        <span>
          Étape {step.step} / {step.total}
        </span>
        <span>{step.percent}%</span>
      </div>
      <div className="mb-2 h-1 w-full shrink-0 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#3db8c5] to-[#e8f7f9]"
          initial={false}
          animate={{ width: `${step.percent}%` }}
          transition={{ type: 'spring', stiffness: 200, damping: 28 }}
        />
      </div>

      <div className="flex min-h-0 w-full flex-1 flex-col justify-center overflow-y-auto py-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={step.step}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="my-auto w-full"
          >
            <h1
              className="text-[1.65rem] leading-snug text-[#e8f7f9] sm:text-3xl"
              style={{ fontFamily: 'var(--font-aqua-display)' }}
            >
              {step.title}
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-[#b8e4ea]/80">
              {step.subtitle}
            </p>
            {step.step === 1 && (
              <p className="mt-1.5 text-xs italic text-[#b8e4ea]/50">
                Tout est strictement anonyme, lâchez-vous dans vos réponses
              </p>
            )}

            <div className="mt-6 space-y-5">
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
            {micHint && (
              <p className="mt-3 text-xs text-[#7ed4df]/80">{micHint}</p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex w-full shrink-0 gap-2 pt-3 pb-1">
        <button
          type="button"
          onClick={goBack}
          className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/15 py-2.5 text-sm font-medium text-[#e8f7f9]/90 transition-colors hover:bg-white/10"
        >
          <ArrowLeft size={16} />
          Retour
        </button>
        <button
          type="button"
          disabled={!canContinue}
          onClick={goNext}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#e8f7f9] py-2.5 text-sm font-semibold text-[#0d3d47] transition-opacity disabled:opacity-40"
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
    'w-full rounded-2xl border border-white/12 bg-white/[0.07] px-4 py-3 text-center text-sm text-[#e8f7f9] placeholder:text-[#b8e4ea]/40 outline-none transition',
    focused && 'aqua-field-lit border-[#7ed4df]/35',
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
      <div className="w-full text-center">
        <p className="text-[13px] font-medium leading-snug text-[#e8f7f9]/90">{field.label}</p>
        <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
          {field.choices?.map((c) => {
            const selected = value === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onChange(c.id)}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all',
                  selected
                    ? 'bg-[#e8f7f9] text-[#0d3d47]'
                    : 'bg-white/[0.06] text-[#e8f7f9]/80 hover:bg-white/10',
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
      <p className="text-[13px] font-medium leading-snug text-[#e8f7f9]/90">{field.label}</p>
      {field.hint && (
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-[#b8e4ea]/55">
          {field.hint}
        </p>
      )}

      <div className="relative mt-2.5">
        {field.type === 'textarea' ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={placeholder ?? field.placeholder}
            rows={3}
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
            field.type === 'textarea' ? 'top-3' : 'top-1/2 -translate-y-1/2',
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
      <p className="text-[13px] font-medium leading-snug text-[#e8f7f9]/90">{fieldLabel}</p>
      <p className="mt-1 text-xs text-[#b8e4ea]/55">Écoute, puis choisis</p>
      <audio ref={audioRef} playsInline preload="none" onEnded={stopPreview} />
      <div className="mt-3 flex items-end justify-center gap-3">
        {AQUA_VOICES.map((v) => {
          const selected = value === v.id
          const playing = playingId === v.id
          return (
            <div key={v.id} className="flex w-[4.75rem] flex-col items-center gap-1.5 sm:w-[5.25rem]">
              <div
                className={cn(
                  'relative h-[4.75rem] w-[4.75rem] overflow-hidden rounded-2xl transition-all sm:h-[5.25rem] sm:w-[5.25rem]',
                  selected
                    ? 'ring-2 ring-[#7ed4df] shadow-[0_0_14px_rgba(126,212,223,0.3)]'
                    : 'ring-1 ring-white/12',
                )}
              >
                <button
                  type="button"
                  onClick={() => onChange(v.id)}
                  aria-label={v.label}
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
                    'absolute bottom-1.5 left-1/2 z-10 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full backdrop-blur-sm',
                    playing ? 'bg-[#7ed4df] text-[#0d3d47]' : 'bg-black/45 text-[#e8f7f9]',
                  )}
                >
                  {playing ? (
                    <Pause size={10} className="fill-current" />
                  ) : (
                    <Play size={10} className="fill-current" />
                  )}
                </button>
              </div>
              <span
                className={cn(
                  'text-[11px] font-medium',
                  selected ? 'text-[#7ed4df]' : 'text-[#b8e4ea]/75',
                )}
              >
                {v.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

