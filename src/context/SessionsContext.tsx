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
import { useAuth } from '@/context/AuthContext'
import { sessionsService } from '@/services/sessions'
import { progressService } from '@/services/progress'

interface SessionsContextValue {
  sessions: VisualizationSession[]
  stats: ProgressStats
  addSession: (answers: VisualizationAnswers) => Promise<VisualizationSession>
  removeSession: (id: string) => void
  markListened: (id: string) => void
  simulateProgress: (days: number) => void
  resetProgress: () => void
}

const SessionsContext = createContext<SessionsContextValue | null>(null)

export function SessionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id
  const [sessions, setSessions] = useState<VisualizationSession[]>([])
  const [stats, setStats] = useState<ProgressStats>(() => progressService.getLocalStats())

  useEffect(() => {
    void sessionsService.list(userId).then(setSessions)
  }, [userId])

  useEffect(() => {
    if (!userId) sessionsService.persistLocal(sessions)
  }, [sessions, userId])

  useEffect(() => {
    progressService.persistLocal(stats)
  }, [stats])

  const addSession = useCallback(
    async (answers: VisualizationAnswers) => {
      const session = await sessionsService.create(answers, userId)
      setSessions((prev) => [session, ...prev.filter((s) => s.id !== session.id)])
      return session
    },
    [userId],
  )

  const removeSession = useCallback(
    (id: string) => {
      setSessions((prev) => prev.filter((s) => s.id !== id))
      void sessionsService.remove(id, userId).catch((err) => {
        console.warn('[sessions] remove failed', err)
      })
    },
    [userId],
  )

  const markListened = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const target = prev.find((s) => s.id === id)
        if (!target) return prev
        const nextListens = target.listens + 1
        void sessionsService.markListened(id, nextListens, userId).catch((err) => {
          console.warn('[sessions] markListened failed', err)
        })
        return prev.map((s) => (s.id === id ? { ...s, listens: nextListens } : s))
      })
      setStats((prev) => progressService.recordListen(prev))
    },
    [userId],
  )

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
