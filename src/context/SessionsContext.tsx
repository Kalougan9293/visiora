import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { ProgressStats, VisualizationAnswers, VisualizationSession } from '@/types'
import { uid } from '@/lib/utils'
import { sessionsService } from '@/services/sessions'
import { progressService } from '@/services/progress'

interface SessionsContextValue {
  sessions: VisualizationSession[]
  stats: ProgressStats
  addSession: (answers: VisualizationAnswers) => VisualizationSession
  removeSession: (id: string) => void
  markListened: (id: string) => void
  simulateProgress: (days: number) => void
  resetProgress: () => void
}

const SessionsContext = createContext<SessionsContextValue | null>(null)

function titleFromAnswers(answers: VisualizationAnswers): string {
  const q1 = answers.q1
  if (typeof q1 === 'string' && q1.trim()) {
    return q1.trim().slice(0, 42) + (q1.trim().length > 42 ? '…' : '')
  }
  return 'Séance personnalisée'
}

function durationFromAnswers(_answers: VisualizationAnswers): number {
  return 15
}

export function SessionsProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<VisualizationSession[]>([])
  const [stats, setStats] = useState<ProgressStats>(() => progressService.getLocalStats())

  useEffect(() => {
    void sessionsService.list().then(setSessions)
  }, [])

  useEffect(() => {
    sessionsService.persistLocal(sessions)
  }, [sessions])

  useEffect(() => {
    progressService.persistLocal(stats)
  }, [stats])

  const addSession = useCallback((answers: VisualizationAnswers) => {
    const now = new Date().toISOString()
    const session: VisualizationSession = {
      id: uid('ses'),
      title: titleFromAnswers(answers),
      createdAt: now,
      updatedAt: now,
      durationMinutes: durationFromAnswers(answers),
      answers,
      status: 'ready',
      audioUrl: null,
      listens: 0,
    }
    setSessions((prev) => [session, ...prev])
    return session
  }, [])

  const removeSession = useCallback((id: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const markListened = useCallback((id: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, listens: s.listens + 1 } : s)),
    )
    setStats((prev) => progressService.recordListen(prev))
  }, [])

  const simulateProgress = useCallback((days: number) => {
    setStats(progressService.simulateDays(days))
  }, [])

  const resetProgress = useCallback(() => {
    setStats(progressService.reset())
  }, [])

  const value = useMemo(
    () => ({
      sessions,
      stats,
      addSession,
      removeSession,
      markListened,
      simulateProgress,
      resetProgress,
    }),
    [sessions, stats, addSession, removeSession, markListened, simulateProgress, resetProgress],
  )

  return (
    <SessionsContext.Provider value={value}>{children}</SessionsContext.Provider>
  )
}

export function useSessions() {
  const ctx = useContext(SessionsContext)
  if (!ctx) throw new Error('useSessions must be used within SessionsProvider')
  return ctx
}
