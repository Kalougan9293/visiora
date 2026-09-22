import { progressService } from '@/services/progress'
import type { ProgressStats } from '@/types'

export function WelcomeBack({ stats }: { stats: ProgressStats }) {
  if (!progressService.returnedAfterGap(stats)) return null
  return (
    <p className="w-full max-w-sm text-center text-sm leading-relaxed text-ink/72 dark:text-champagne/88">
      Content de te retrouver. On reprend là où tu en étais.
    </p>
  )
}
