import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { voicesLabService, type ElevenVoicePreview } from '@/services/voicesLab'
import { cn } from '@/lib/utils'

/**
 * Lab local : extraits officiels ElevenLabs (preview_url).
 * Aucun crédit TTS — ce n’est pas une génération de séance.
 */
export function VoicesLabPage() {
  const { user, configured } = useAuth()
  const [voices, setVoices] = useState<ElevenVoicePreview[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!user) return
    setLoading(true)
    setError('')
    void voicesLabService
      .list()
      .then(setVoices)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Impossible de charger les voix')
      })
      .finally(() => setLoading(false))
  }, [user])

  const toggle = async (voice: ElevenVoicePreview) => {
    const current = audioRef.current
    if (playingId === voice.id && current && !current.paused) {
      current.pause()
      setPlayingId(null)
      return
    }
    current?.pause()
    const el = new Audio(voice.previewUrl)
    el.preload = 'auto'
    el.setAttribute('playsinline', 'true')
    audioRef.current = el
    el.onended = () => setPlayingId(null)
    el.onpause = () => {
      if (el.ended) return
      if (audioRef.current === el) setPlayingId(null)
    }
    try {
      await el.play()
      setPlayingId(voice.id)
    } catch (err) {
      console.warn('[voix] preview failed', err)
      setPlayingId(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center pb-4 text-center">
      <h1 className="font-display text-3xl tracking-tight text-ink dark:text-cream">Voix</h1>
      <p className="mt-2 max-w-sm text-sm text-ink/68 dark:text-champagne/86">
        Extraits ElevenLabs. Écoute libre, sans créer de séance et sans crédits TTS.
        Les 3 voix déjà branchées sont marquées.
      </p>

      {!configured && (
        <p className="mt-6 text-sm text-red-500">Supabase non configuré.</p>
      )}
      {configured && !user && (
        <p className="mt-6 text-sm text-ink/70 dark:text-champagne/85">
          Connecte-toi (bouton Connexion) pour charger le catalogue.
        </p>
      )}
      {loading && <p className="mt-6 text-sm text-ink/50">Chargement…</p>}
      {error && <p className="mt-6 text-sm text-red-500">{error}</p>}

      <div className="mt-6 w-full space-y-1.5">
        {voices.map((voice) => (
          <div
            key={voice.id}
            className="flex h-11 w-full items-center gap-2 rounded-xl border border-black/8 bg-cream-card/80 px-2.5 dark:border-[var(--vs-ardoise)] dark:bg-[var(--vs-abysse)]"
          >
            <p className="min-w-0 flex-1 truncate text-left text-sm font-medium text-ink dark:text-cream">
              {voice.name}
              {voice.slot && (
                <span className="ml-1.5 font-normal text-olive dark:text-[var(--vs-azur)]">
                  · {voice.slot}
                </span>
              )}
              <span className="ml-1.5 font-normal text-ink/45 dark:text-champagne/70">
                {voice.gender || voice.category}
              </span>
            </p>
            <button
              type="button"
              onClick={() => void toggle(voice)}
              aria-label={playingId === voice.id ? 'Pause' : `Écouter ${voice.name}`}
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                'bg-olive text-cream dark:bg-gold dark:text-ink',
              )}
            >
              {playingId === voice.id ? (
                <Pause size={15} />
              ) : (
                <Play size={15} className="ml-0.5" />
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
