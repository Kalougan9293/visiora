import { useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, RotateCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { holdAmbiance, releaseAmbiance, type AmbianceChoice } from '@/services/ambiance'
import { AI_DISCLOSURE } from '@/data/uiCopy'
import { hasListenedEnough } from '@/lib/listenThreshold'

function formatClock(seconds: number) {
  const total = Math.max(0, Math.round(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

interface AudioPlayerProps {
  src?: string | null
  title: string
  subtitle?: string
  onPlayStart?: () => void
  /** Nouvelle lecture (pas une reprise après pause). */
  onListenBegin?: () => void
  /** Position courante. `ended` = la piste est allée au bout. */
  onListenSample?: (sample: { current: number; duration: number; ended: boolean }) => void
  /** Durée réelle du fichier, dès que le navigateur l’a lue. */
  onDuration?: (seconds: number) => void
  className?: string
  /** Bouton play seul, pour une ligne de bibliothèque */
  compact?: boolean
  /** Barre, temps écoulé / restant, et sauts de 10 s. */
  library?: boolean
  ambiance?: AmbianceChoice
}

export function AudioPlayer({
  src,
  title,
  subtitle,
  onPlayStart,
  onListenBegin,
  onListenSample,
  onDuration,
  className,
  compact = false,
  library = false,
  ambiance = null,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [current, setCurrent] = useState(0)
  const [durationSec, setDurationSec] = useState(0)
  const countedRef = useRef(false)
  const bedHeldRef = useRef(false)
  const onSampleRef = useRef(onListenSample)
  const onBeginRef = useRef(onListenBegin)
  const onDurationRef = useRef(onDuration)
  const lastSampleRef = useRef({ current: 0, duration: 0 })
  const lastSentRef = useRef(0)
  onSampleRef.current = onListenSample
  onBeginRef.current = onListenBegin
  onDurationRef.current = onDuration

  const dropBed = () => {
    if (!bedHeldRef.current) return
    bedHeldRef.current = false
    releaseAmbiance()
  }

  const takeBed = () => {
    if (!ambiance) return
    if (bedHeldRef.current) return
    bedHeldRef.current = true
    holdAmbiance(ambiance)
  }

  useEffect(() => {
    setPlaying(false)
    setProgress(0)
    setCurrent(0)
    setDurationSec(0)
    countedRef.current = false
    dropBed()
    return () => dropBed()
  }, [src, ambiance])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    const markIfEnough = (ended = false) => {
      if (countedRef.current) return
      if (!hasListenedEnough(el.currentTime, el.duration, ended)) return
      countedRef.current = true
      onPlayStart?.()
    }

    const remember = (ended = false, force = false) => {
      const duration = Number.isFinite(el.duration) ? el.duration : 0
      const current = Number.isFinite(el.currentTime) ? el.currentTime : 0
      lastSampleRef.current = { current, duration }
      const now = Date.now()
      if (!force && !ended && now - lastSentRef.current < 5000) return
      lastSentRef.current = now
      onSampleRef.current?.({ current, duration, ended })
    }
    const syncClock = () => {
      const duration = Number.isFinite(el.duration) ? el.duration : 0
      const now = Number.isFinite(el.currentTime) ? el.currentTime : 0
      setCurrent(now)
      setDurationSec(duration)
      if (duration > 0) setProgress((now / duration) * 100)
    }
    const onTime = () => {
      if (!el.duration || Number.isNaN(el.duration)) return
      syncClock()
      markIfEnough(false)
      remember(false)
    }
    const onEnd = () => {
      setPlaying(false)
      setProgress(100)
      markIfEnough(true)
      dropBed()
      remember(true, true)
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => {
      if (!el.ended) setPlaying(false)
      remember(el.ended, true)
    }

    const onMeta = () => {
      syncClock()
      if (Number.isFinite(el.duration) && el.duration > 0) onDurationRef.current?.(el.duration)
    }
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('durationchange', onMeta)
    onMeta()
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('ended', onEnd)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    return () => {
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('durationchange', onMeta)
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('ended', onEnd)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      const last = lastSampleRef.current
      if (last.duration > 0) {
        onSampleRef.current?.({ current: last.current, duration: last.duration, ended: el.ended })
      }
    }
  }, [src, onPlayStart])

  const toggle = async () => {
    const el = audioRef.current
    if (!src || !el) return
    if (!el.paused && !el.ended) {
      el.pause()
      dropBed()
      return
    }
    try {
      const fresh = el.ended || el.currentTime < 0.4
      if (el.ended || (el.duration && el.currentTime >= el.duration - 0.05)) {
        el.currentTime = 0
        setProgress(0)
        countedRef.current = false
      }
      if (fresh) onBeginRef.current?.()
      takeBed()
      document.querySelectorAll('audio').forEach((node) => {
        if (node !== el) node.pause()
      })
      await el.play()
    } catch (err) {
      console.warn('[audio] play failed', err)
      setPlaying(false)
      dropBed()
    }
  }

  const seekTo = (seconds: number) => {
    const el = audioRef.current
    if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return
    const next = Math.min(el.duration, Math.max(0, seconds))
    el.currentTime = next
    setCurrent(next)
    setProgress((next / el.duration) * 100)
  }

  const audioEl = src ? (
    <audio
      ref={audioRef}
      src={src}
      className="hidden"
      preload="metadata"
      playsInline
      controls={false}
    />
  ) : null

  const playButton = (
    <Button
      variant="primary"
      size="sm"
      className={cn(
        '!rounded-full !px-0 !py-0 shrink-0 hover:!translate-y-0',
        library || compact ? '!h-10 !w-10' : 'h-12 w-12',
      )}
      onClick={() => void toggle()}
      disabled={!src}
      aria-label={playing ? 'Pause' : 'Lecture'}
    >
      {playing ? <Pause size={compact ? 15 : 18} /> : <Play size={compact ? 15 : 18} className="ml-0.5" />}
    </Button>
  )

  if (library) {
    const remain = Math.max(0, durationSec - current)
    return (
      <div className={cn('w-full px-1 pb-1 pt-2', className)}>
        {audioEl}
        <input
          type="range"
          min={0}
          max={durationSec > 0 ? durationSec : 0}
          step={0.1}
          value={Math.min(current, durationSec || 0)}
          disabled={!src || durationSec <= 0}
          aria-label="Position dans la séance"
          onChange={(event) => seekTo(Number(event.target.value))}
          className="h-1 w-full cursor-pointer accent-[var(--vs-azur)] disabled:opacity-40"
        />
        <div className="mt-1 flex justify-between text-[11px] tabular-nums text-ink/70 dark:text-champagne/85">
          <span>{formatClock(current)}</span>
          <span>-{formatClock(remain)}</span>
        </div>
        <div className="mt-1 flex items-center justify-center gap-6">
          <button
            type="button"
            aria-label="Reculer de 10 secondes"
            disabled={!src}
            onClick={() => seekTo(current - 10)}
            className="flex h-9 items-center justify-center gap-0.5 rounded-full px-2 text-ink/70 disabled:opacity-40 dark:text-champagne"
          >
            <RotateCcw size={16} />
            <span className="text-[10px] font-semibold leading-none">10</span>
          </button>
          {playButton}
          <button
            type="button"
            aria-label="Avancer de 10 secondes"
            disabled={!src}
            onClick={() => seekTo(current + 10)}
            className="flex h-9 items-center justify-center gap-0.5 rounded-full px-2 text-ink/70 disabled:opacity-40 dark:text-champagne"
          >
            <span className="text-[10px] font-semibold leading-none">10</span>
            <RotateCw size={16} />
          </button>
        </div>
      </div>
    )
  }

  if (compact) {
    return (
      <div className={cn('relative shrink-0', className)}>
        {audioEl}
        {playButton}
      </div>
    )
  }

  return (
    <div className={cn('glass rounded-2xl p-4', className)}>
      {audioEl}
      <div className="flex flex-col items-center gap-3">
        {playButton}
        <div className="w-full">
          <p className="font-medium text-sm">{title}</p>
          {subtitle && (
            <p className="mt-0.5 text-xs text-ink/76 dark:text-champagne/90">{subtitle}</p>
          )}
          <p className="mt-1 text-xs text-ink/70 dark:text-champagne/80">{AI_DISCLOSURE.player}</p>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/8 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-[var(--vs-azur)] transition-[width] duration-200"
              style={{ width: `${src ? progress : 0}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
