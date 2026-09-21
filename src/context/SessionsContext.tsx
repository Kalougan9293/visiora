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
/** 15 min d’audio + file : ne pas crier à l’échec trop tôt. */
const CLIENT_STALE_MS = 40 * 60 * 1000
/** Filet local seulement si N8N n’orchestre pas. */
const CONTINUE_KICK_MS = 8_000

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
  const kickedRef = useRef(new Set<string>())
  const inFlightRef = useRef(new Set<string>())
  const lastKickAtRef = useRef<Record<string, number>>({})
  /** Séances confiées à N8N : pas de re-kick agressif côté téléphone. */
  const orchestratedRef = useRef(new Set<string>())

  useEffect(() => {
    kickedRef.current.clear()
    inFlightRef.current.clear()
    lastKickAtRef.current = {}
    orchestratedRef.current.clear()
    if (!userId) {
      setSessions([])
      sessionsService.clearLocal()
      return
    }
    void sessionsService.list(userId).then((rows) => {
      setSessions(rows)
    })
  }, [userId])

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
    /** Verrou sync immédiat : empêche 2 invokes parallèles sur la même séance. */
    if (!force && kickedRef.current.has(sessionId)) {
      const last = lastKickAtRef.current[sessionId] ?? 0
      if (Date.now() - last < CONTINUE_KICK_MS) return
    }
    if (!force && inFlightRef.current.has(sessionId)) return
    kickedRef.current.add(sessionId)
    inFlightRef.current.add(sessionId)
    lastKickAtRef.current[sessionId] = Date.now()
    try {
      const result = await audioService.enqueueGeneration(sessionId, force)
      if (result.orchestrated) {
        orchestratedRef.current.add(sessionId)
      }
      if (result.status === 'ready') {
        const fresh = userId ? await sessionsService.get(sessionId, userId) : null
        if (fresh) mergeSession(fresh)
        kickedRef.current.delete(sessionId)
        return
      }
      if (!result.ok) {
        console.warn('[sessions] enqueue fail', result.error)
        kickedRef.current.delete(sessionId)
      }
    } finally {
      inFlightRef.current.delete(sessionId)
    }
  }, [userId, mergeSession])

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
          delete lastKickAtRef.current[id]
          orchestratedRef.current.delete(id)
          continue
        }
        const age = Date.now() - new Date(fresh.updatedAt).getTime()
        if (fresh.status === 'generating' && age > CLIENT_STALE_MS) {
          kickedRef.current.delete(id)
          mergeSession({ ...fresh, status: 'failed' })
          continue
        }
        /** Filet local seulement si N8N ne gère pas la boucle. */
        if (
          fresh.status === 'generating' &&
          age > CONTINUE_KICK_MS &&
          !orchestratedRef.current.has(id)
        ) {
          void enqueueAudio(id, false)
        }
      }
    }

    void tick()
    const timer = window.setInterval(() => void tick(), POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [userId, generatingKey, mergeSession, enqueueAudio])

  useEffect(() => {
    if (!userId || !generatingKey) return
    /** Un seul kick initial par séance — le filet poll + chain serveur font le reste. */
    for (const id of generatingKey.split(',')) {
      if (kickedRef.current.has(id)) continue
      void enqueueAudio(id, false)
    }
  }, [userId, generatingKey, enqueueAudio])

  const addSession = useCallback(
    async (answers: VisualizationAnswers) => {
      const session = await sessionsService.create(answers, userId)
      setSessions((prev) => [session, ...prev.filter((s) => s.id !== session.id)])
      /** Un seul kick via l’effet generatingKey — évite double TTS / même audio ×2. */
      return session
    },
    [userId],
  )

  const retryGeneration = useCallback(
    async (sessionId: string) => {
      if (!userId) return
      kickedRef.current.delete(sessionId)
      delete lastKickAtRef.current[sessionId]
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, status: 'generating', audioProgress: 5, updatedAt: new Date().toISOString() }
            : s,
        ),
      )
      /** Reprise sans reset : segments déjà payés / uploadés sont réutilisés. */
      await enqueueAudio(sessionId, false)
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
