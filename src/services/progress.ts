import type { DayLogEntry, ProgressStats } from '@/types'

const LOCAL_KEY = 'visiora-progress'

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function buildEmptyJournal(days = 28): DayLogEntry[] {
  const entries: DayLogEntry[] = []
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    entries.push({
      date: d.toISOString().slice(0, 10),
      completed: false,
      listenCount: 0,
    })
  }
  return entries
}

function defaultStats(): ProgressStats {
  return {
    streakDays: 0,
    totalListens: 0,
    milestoneTarget: 21,
    daysCompletedTowardMilestone: 0,
    journal: buildEmptyJournal(),
  }
}

export const progressService = {
  getLocalStats(): ProgressStats {
    try {
      const raw = localStorage.getItem(LOCAL_KEY)
      if (!raw) return defaultStats()
      const parsed = JSON.parse(raw) as ProgressStats
      // Refresh rolling window while keeping completion flags
      const window = Math.max(28, parsed.journal?.length ?? 28)
      const fresh = buildEmptyJournal(window)
      const map = new Map(parsed.journal.map((j) => [j.date, j]))
      return {
        ...parsed,
        journal: fresh.map((d) => map.get(d.date) ?? d),
      }
    } catch {
      return defaultStats()
    }
  },

  persistLocal(stats: ProgressStats) {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(stats))
  },

  recordListen(prev: ProgressStats): ProgressStats {
    const key = todayKey()
    const journal = prev.journal.map((d) =>
      d.date === key
        ? { ...d, completed: true, listenCount: d.listenCount + 1 }
        : d,
    )
    const wasAlready = prev.journal.find((d) => d.date === key)?.completed
    const daysCompletedTowardMilestone = wasAlready
      ? prev.daysCompletedTowardMilestone
      : Math.min(prev.milestoneTarget, prev.daysCompletedTowardMilestone + 1)

    return {
      ...prev,
      totalListens: prev.totalListens + 1,
      streakDays: wasAlready ? prev.streakDays : prev.streakDays + 1,
      daysCompletedTowardMilestone,
      journal,
    }
  },

  /** Simulateur de test — marque N jours d’écoute consécutifs. */
  simulateDays(days: number): ProgressStats {
    const target = days > 21 ? 60 : 21
    const journal = buildEmptyJournal(Math.max(28, days))
    const filled = journal.map((entry, i) => {
      const fromEnd = journal.length - i
      if (fromEnd <= days) {
        return { ...entry, completed: true, listenCount: 1 }
      }
      return entry
    })
    return {
      streakDays: days,
      totalListens: days,
      milestoneTarget: target,
      daysCompletedTowardMilestone: Math.min(days, target),
      journal: filled,
    }
  },

  reset(): ProgressStats {
    return defaultStats()
  },
}
