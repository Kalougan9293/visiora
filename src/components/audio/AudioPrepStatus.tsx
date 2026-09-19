import { ProgressBar } from '@/components/ui/ProgressBar'

export function AudioPrepStatus({ progress, className }: { progress: number; className?: string }) {
  const pct = Math.min(99, Math.max(5, Math.round(progress)))
  return (
    <div className={className ?? 'w-full max-w-xs pt-1'}>
      <ProgressBar value={pct} label="Préparation de l'audio" />
    </div>
  )
}
