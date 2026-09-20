import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { ProgressStats, VisualizationAnswers, VisualizationSession } from '@/types'
import { useAuth } from '@/context/AuthContext'
import { audioService } from '@/services/audio'
import { sessionsService } from '@/services/sessions'
import { progressService } from '@/services/progress'

const POLL_MS = 1500
const CLIENT_STALE_MS = 10 * 60 * 1000

interface SessionsContextValue {
  sessions: VisualizationSession[]
  stats: ProgressStats
  addSession: (answers: VisualizationAnswers) => Promise<VisualizationSession>
  removeSession: (id: string) => void
  markListened: (id: string) => void
  retryGeneration: (sessionId: string) => Promise<void>
  simulateProgress: (days: number) => void
  resetProgress: () => void
}

const SessionsContext = createContext<SessionsContextValue | null>(null)

export function SessionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id
  const [sessions, setSessions] = useState<VisualizationSession[]>([])
  const [stats, setStats] = useState<ProgressStats>(() => progressService.getLocalStats())
  const [hydrated, setHydrated] = useState(false)
  const kickedRef = useRef(new Set<string>())

  useEffect(() => {
    setHydrated(false)
    void sessionsService.list(userId).then((rows) => {
      setSessions(rows)
      setHydrated(true)
    })
  }, [userId])

  useEffect(() => {
    if (!userId && hydrated) sessionsService.persistLocal(sessions)
  }, [sessions, userId, hydrated])

  useEffect(() => {
    progressService.persistLocal(stats)
  }, [stats])

  const mergeSession = useCallback((fresh: VisualizationSession) => {
    setSessions((prev) => {
      const index = prev.findIndex((s) => s.id === fresh.id)
      if (index === -1) return prev
      const current = prev[index]
      if (
        current.status === fresh.status &&
        current.audioUrl === fresh.audioUrl &&
        current.audioStoragePath === fresh.audioStoragePath &&
        current.audioProgress === fresh.audioProgress &&
        current.script === fresh.script
      ) {
        return prev
      }
      const next = [...prev]
      next[index] = { ...current, ...fresh }
      return next
    })
  }, [])

  const enqueueAudio = useCallback(async (sessionId: string, force = false) => {
    if (!force && kickedRef.current.has(sessionId)) return
    kickedRef.current.add(sessionId)
    const result = await audioService.enqueueGeneration(sessionId, force)
    if (!result.ok) {
      kickedRef.current.delete(sessionId)
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, status: 'failed', updatedAt: new Date().toISOString() } : s,
        ),
      )
    }
  }, [])

  const generatingKey = sessions
    .filter((s) => s.status === 'generating')
    .map((s) => s.id)
    .join(',')

  useEffect(() => {
    if (!userId || !generatingKey) return
    const ids = generatingKey.split(',')
    let cancelled = false

    const tick = async () => {
      for (const id of ids) {
        const fresh = await sessionsService.get(id, userId)
        if (cancelled || !fresh) continue
        mergeSession(fresh)
        if (fresh.status === 'ready' || fresh.status === 'failed') {
          kickedRef.current.delete(id)
          continue
        }
        const age = Date.now() - new Date(fresh.updatedAt).getTime()
        if (fresh.status === 'generating' && age > CLIENT_STALE_MS) {
          kickedRef.current.delete(id)
          mergeSession({ ...fresh, status: 'failed' })
        }
      }
    }

    void tick()
    const timer = window.setInterval(() => void tick(), POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [userId, generatingKey, mergeSession])

  useEffect(() => {
    if (!userId || !generatingKey) return
    for (const id of generatingKey.split(',')) {
      void enqueueAudio(id)
    }
  }, [userId, generatingKey, enqueueAudio])

  const addSession = useCallback(
    async (answers: VisualizationAnswers) => {
      const session = await sessionsService.create(answers, userId)
      setSessions((prev) => [session, ...prev.filter((s) => s.id !== session.id)])

      if (userId && session.status === 'generating') {
        void enqueueAudio(session.id, true)
      }

      return session
    },
    [userId, enqueueAudio],
  )

  const retryGeneration = useCallback(
    async (sessionId: string) => {
      if (!userId) return
      kickedRef.current.delete(sessionId)
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId ? { ...s, status: 'generating', audioProgress: 5, updatedAt: new Date().toISOString() } : s,
        ),
      )
      await enqueueAudio(sessionId, true)
    },
    [userId, enqueueAudio],
  )

  const removeSession = useCallback(
    (id: string) => {
      kickedRef.current.delete(id)
      setSessions((prev) => prev.filter((s) => s.id !== id))
      void sessionsService.remove(id, userId).catch((err) => {
        console.warn('[sessions] remove failed', err)
      })
    },
    [userId],
  )

  const markListened = useCallback(
    (id: string) => {
      void (async () => {
        try {
          if (userId) {
            const counted = await sessionsService.markListened(id, 0, userId)
            if (!counted) return
            setSessions((prev) =>
              prev.map((s) => (s.id === id ? { ...s, listens: s.listens + 1 } : s)),
            )
            setStats((prev) => progressService.recordListen(prev))
            return
          }
          /** Invité : 1 jour validé max (journal local) */
          setStats((prev) => {
            const key = new Date().toISOString().slice(0, 10)
            const already = prev.journal.find((d) => d.date === key)?.completed
            if (already) return prev
            return progressService.recordListen(prev)
          })
          setSessions((prev) =>
            prev.map((s) => (s.id === id ? { ...s, listens: s.listens + 1 } : s)),
          )
        } catch (err) {
          console.warn('[sessions] markListened failed', err)
        }
      })()
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
      retryGeneration,
      simulateProgress,
      resetProgress,
    }),
    [
      sessions,
      stats,
      addSession,
      removeSession,
      markListened,
      retryGeneration,
      simulateProgress,
      resetProgress,
    ],
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
