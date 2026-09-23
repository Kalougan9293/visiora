import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { holdAmbiance, releaseAmbiance, type AmbianceChoice } from '@/services/ambiance'
import { AI_DISCLOSURE } from '@/data/uiCopy'
import { hasListenedEnough } from '@/lib/listenThreshold'

interface AudioPlayerProps {
  src?: string | null
  title: string
  subtitle?: string
  onPlayStart?: () => void
  /** Nouvelle lecture (pas une reprise après pause). */
  onListenBegin?: () => void
  /** Position courante. `ended` = la piste est allée au bout. */
  onListenSample?: (sample: { current: number; duration: number; ended: boolean }) => void
  className?: string
  /** Bouton play seul, pour une ligne de bibliothèque */
  compact?: boolean
  ambiance?: AmbianceChoice
}

export function AudioPlayer({
  src,
  title,
  subtitle,
  onPlayStart,
  onListenBegin,
  onListenSample,
  className,
  compact = false,
  ambiance = null,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const countedRef = useRef(false)
  const bedHeldRef = useRef(false)
  const onSampleRef = useRef(onListenSample)
  const onBeginRef = useRef(onListenBegin)
  const lastSampleRef = useRef({ current: 0, duration: 0 })
  const lastSentRef = useRef(0)
  onSampleRef.current = onListenSample
  onBeginRef.current = onListenBegin

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
    const el = audioRef.current
    setPlaying(false)
    setProgress(0)
    countedRef.current = false
    dropBed()
    if (el && src) {
      el.pause()
      el.src = src
      el.load()
    }
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
    const onTime = () => {
      if (!el.duration || Number.isNaN(el.duration)) return
      setProgress((el.currentTime / el.duration) * 100)
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

    el.addEventListener('timeupdate', onTime)
    el.addEventListener('ended', onEnd)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    return () => {
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
      await el.play()
    } catch (err) {
      console.warn('[audio] play failed', err)
      setPlaying(false)
      dropBed()
    }
  }

  const audioEl = src ? (
    <audio
      ref={audioRef}
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
        compact ? '!h-9 !w-9' : 'h-12 w-12',
      )}
      onClick={() => void toggle()}
      disabled={!src}
      aria-label={playing ? 'Pause' : 'Lecture'}
    >
      {playing ? <Pause size={compact ? 15 : 18} /> : <Play size={compact ? 15 : 18} className="ml-0.5" />}
    </Button>
  )

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
