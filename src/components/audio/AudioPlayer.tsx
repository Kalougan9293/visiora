import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { holdAmbiance, releaseAmbiance, type AmbianceChoice } from '@/services/ambiance'

interface AudioPlayerProps {
  src?: string | null
  title: string
  subtitle?: string
  onPlayStart?: () => void
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
  className,
  compact = false,
  ambiance = 'eau',
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const countedRef = useRef(false)
  const bedHeldRef = useRef(false)

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

    const onTime = () => {
      if (!el.duration || Number.isNaN(el.duration)) return
      setProgress((el.currentTime / el.duration) * 100)
    }
    const onEnd = () => {
      setPlaying(false)
      setProgress(100)
      countedRef.current = false
      dropBed()
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => {
      if (!el.ended) setPlaying(false)
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
    }
  }, [src])

  const toggle = async () => {
    const el = audioRef.current
    if (!src || !el) return
    if (!el.paused && !el.ended) {
      el.pause()
      dropBed()
      return
    }
    try {
      if (el.ended || (el.duration && el.currentTime >= el.duration - 0.05)) {
        el.currentTime = 0
        setProgress(0)
      }
      takeBed()
      await el.play()
      if (!countedRef.current) {
        countedRef.current = true
        onPlayStart?.()
      }
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
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/8 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-gold transition-[width] duration-200"
              style={{ width: `${src ? progress : 0}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
