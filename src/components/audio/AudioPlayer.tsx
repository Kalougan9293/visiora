import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

interface AudioPlayerProps {
  src?: string | null
  title: string
  subtitle?: string
  onPlayStart?: () => void
  className?: string
}

export function AudioPlayer({
  src,
  title,
  subtitle,
  onPlayStart,
  className,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onTime = () => {
      if (!el.duration) return
      setProgress((el.currentTime / el.duration) * 100)
    }
    const onEnd = () => setPlaying(false)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('ended', onEnd)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('ended', onEnd)
    }
  }, [src])

  const toggle = async () => {
    const el = audioRef.current
    if (!src || !el) {
      setPlaying((p) => !p)
      if (!playing) onPlayStart?.()
      return
    }
    if (playing) {
      el.pause()
      setPlaying(false)
    } else {
      await el.play()
      setPlaying(true)
      onPlayStart?.()
    }
  }

  return (
    <div className={cn('glass rounded-2xl p-4', className)}>
      {src ? <audio ref={audioRef} src={src} preload="metadata" /> : null}
      <div className="flex flex-col items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          className="!rounded-full !px-0 h-12 w-12 shrink-0"
          onClick={() => void toggle()}
          aria-label={playing ? 'Pause' : 'Lecture'}
        >
          {playing ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
        </Button>
        <div className="w-full">
          <p className="font-medium text-sm">{title}</p>
          {subtitle && (
            <p className="mt-0.5 text-xs text-ink/65 dark:text-champagne/78">{subtitle}</p>
          )}
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/8 dark:bg-white/10">
            <div
              className="h-full rounded-full bg-gold transition-[width] duration-200"
              style={{ width: `${src ? progress : playing ? 35 : 0}%` }}
            />
          </div>
          {!src && (
            <p className="mt-1.5 text-[10px] uppercase tracking-wider text-ink/50 dark:text-champagne/70">
              Audio à brancher (ElevenLabs)
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
