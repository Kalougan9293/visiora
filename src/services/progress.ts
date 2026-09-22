import type { DayLogEntry, ProgressStats } from '@/types'

const LOCAL_KEY = 'visiora-progress'

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function shiftDateKey(key: string, days: number) {
  const d = new Date(`${key}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const PRACTICE_MARKS = [3, 7, 21, 30, 50, 60] as const

function nextMilestoneTarget(days: number) {
  return PRACTICE_MARKS.find((mark) => days < mark) ?? 60
}

/** Phrase de rythme sur 14 jours — constate, ne recommande pas. */
export function rhythmSentence(journal: { date: string; completed: boolean }[]): string {
  const last14 = journal.slice(-14)
  const done = last14.filter((d) => d.completed)
  if (done.length === 0) return 'Ton calendrier se remplira au fil de tes écoutes.'
  if (done.length === 1) return 'Ta première séance est posée.'

  const times = done
    .map((d) => new Date(`${d.date}T12:00:00`).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b)
  const gaps: number[] = []
  for (let i = 1; i < times.length; i++) {
    gaps.push((times[i] - times[i - 1]) / 86_400_000)
  }
  const avg = gaps.reduce((sum, n) => sum + n, 0) / gaps.length
  if (avg < 2) return 'En ce moment, tu écoutes presque chaque jour.'
  if (avg <= 4) return 'En ce moment, une séance tous les trois jours environ. C’est un bon rythme.'
  if (avg <= 8) return 'En ce moment, une séance par semaine environ.'
  return 'Tes séances sont assez espacées en ce moment.'
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
      : prev.daysCompletedTowardMilestone + 1

    return {
      ...prev,
      totalListens: prev.totalListens + 1,
      streakDays: wasAlready ? prev.streakDays : prev.streakDays + 1,
      daysCompletedTowardMilestone,
      milestoneTarget: nextMilestoneTarget(daysCompletedTowardMilestone),
      journal,
    }
  },

  /** Simulateur de test — marque N jours d’écoute consécutifs. */
  simulateDays(days: number): ProgressStats {
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
      milestoneTarget: nextMilestoneTarget(days),
      daysCompletedTowardMilestone: days,
      journal: filled,
    }
  },

  reset(): ProgressStats {
    return defaultStats()
  },

  /** Construit le Suivi depuis la table `listens` (1 jour = 1 case, total acquis). */
  fromListenRows(listenedOn: string[], rowCount: number): ProgressStats {
    const unique = [...new Set(listenedOn.filter(Boolean))].sort()
    const days = unique.length
    const journal = buildEmptyJournal(Math.max(28, 14))
    const set = new Set(unique)
    return {
      streakDays: days,
      totalListens: Math.max(rowCount, days),
      milestoneTarget: nextMilestoneTarget(days),
      daysCompletedTowardMilestone: days,
      journal: journal.map((d) =>
        set.has(d.date) ? { ...d, completed: true, listenCount: 1 } : d,
      ),
    }
  },

  /** Pause dans le calendrier : des jours acquis, mais ni aujourd’hui ni hier. */
  returnedAfterGap(stats: ProgressStats): boolean {
    if (stats.daysCompletedTowardMilestone <= 0) return false
    const today = todayKey()
    const yesterday = shiftDateKey(today, -1)
    const done = (key: string) => stats.journal.some((d) => d.date === key && d.completed)
    return !done(today) && !done(yesterday)
  },
}
