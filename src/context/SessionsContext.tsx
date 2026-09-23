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
import type { ListenMark, ProgressStats, VisualizationAnswers, VisualizationSession } from '@/types'
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
  sessionsReady: boolean
  /** Journées validées, chacune rattachée à une visualisation. */
  listenMarks: ListenMark[]
  /** Totaux du compte (profil). Le Suivi filtre `listenMarks` par visualisation. */
  stats: ProgressStats
  addSession: (answers: VisualizationAnswers) => Promise<VisualizationSession>
  adjustSession: (sessionId: string, answers: VisualizationAnswers) => Promise<VisualizationSession>
  removeSession: (id: string) => void
  forgetSessions: (ids: string[]) => Promise<void>
  markListened: (id: string) => void
  retryGeneration: (sessionId: string) => Promise<void>
}

const SessionsContext = createContext<SessionsContextValue | null>(null)

export function SessionsProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id
  const [sessions, setSessions] = useState<VisualizationSession[]>([])
  const [sessionsReady, setSessionsReady] = useState(false)
  const [listenMarks, setListenMarks] = useState<ListenMark[]>([])
  const [localStats, setLocalStats] = useState<ProgressStats>(() => progressService.getLocalStats())
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
    if (authLoading) {
      setSessionsReady(false)
      return
    }
    if (!userId) {
      setSessions([])
      setListenMarks([])
      setSessionsReady(true)
      sessionsService.clearLocal()
      return
    }
    let cancelled = false
    setSessionsReady(false)
    setListenMarks([])
    void sessionsService
      .list(userId)
      .then((rows) => {
        if (cancelled) return
        setSessions(rows)
        setSessionsReady(true)
      })
      .catch((err) => {
        console.warn('[sessions] list failed', err)
        if (cancelled) return
        setSessions([])
        setSessionsReady(true)
      })
    void sessionsService.listListenDays(userId).then((listens) => {
      if (cancelled || !listens) return
      setListenMarks(listens)
    })
    return () => {
      cancelled = true
    }
  }, [userId, authLoading])

  useEffect(() => {
    if (userId) return
    progressService.persistLocal(localStats)
  }, [userId, localStats])

  const stats = useMemo(() => {
    if (!userId) return localStats
    return progressService.fromListenRows(
      listenMarks.map((mark) => mark.date),
      listenMarks.length,
    )
  }, [userId, localStats, listenMarks])

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
        current.script === fresh.script &&
        current.title === fresh.title &&
        current.listens === fresh.listens &&
        current.durationMinutes === fresh.durationMinutes
      ) {
        return prev
      }
      const next = [...prev]
      next[index] = { ...current, ...fresh }
      return next
    })
  }, [])

  const enqueueAudio = useCallback(async (
    sessionId: string,
    opts: boolean | { force?: boolean; reset?: boolean } = false,
  ) => {
    const force = typeof opts === 'boolean' ? opts : Boolean(opts.force)
    const reset = typeof opts === 'boolean' ? false : Boolean(opts.reset)
    /** Verrou sync immédiat : empêche 2 invokes parallèles sur la même séance. */
    if (!force && !reset && kickedRef.current.has(sessionId)) {
      const last = lastKickAtRef.current[sessionId] ?? 0
      if (Date.now() - last < CONTINUE_KICK_MS) return
    }
    if (!force && !reset && inFlightRef.current.has(sessionId)) return
    kickedRef.current.add(sessionId)
    inFlightRef.current.add(sessionId)
    lastKickAtRef.current[sessionId] = Date.now()
    try {
      const result = await audioService.enqueueGeneration(sessionId, { force, reset })
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

  const adjustSession = useCallback(
    async (sessionId: string, answers: VisualizationAnswers) => {
      if (!userId) throw new Error('Connexion requise')
      const current = sessions.find((s) => s.id === sessionId)
      const keepTitle = current?.title || sessionsService.titleFromAnswers(answers)
      const q1 = current?.answers.q1
      const merged: VisualizationAnswers = {
        ...answers,
        ...(typeof q1 === 'string' && q1.trim() ? { q1 } : {}),
      }
      const updated = await sessionsService.adjust(sessionId, merged, userId, keepTitle)
      kickedRef.current.delete(sessionId)
      delete lastKickAtRef.current[sessionId]
      orchestratedRef.current.delete(sessionId)
      setSessions((prev) => {
        const exists = prev.some((s) => s.id === sessionId)
        if (!exists) return [updated, ...prev]
        return prev.map((s) => (s.id === sessionId ? { ...s, ...updated } : s))
      })
      await enqueueAudio(sessionId, { force: true, reset: true })
      return updated
    },
    [userId, sessions, enqueueAudio],
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
      setListenMarks((prev) => prev.filter((mark) => mark.sessionId !== id))
      void sessionsService.remove(id, userId).catch((err) => {
        console.warn('[sessions] remove failed', err)
      })
    },
    [userId],
  )

  const forgetSessions = useCallback(
    async (ids: string[]) => {
      if (!ids.length) return
      if (!userId) throw new Error('Connexion requise')
      for (const id of ids) {
        await sessionsService.remove(id, userId)
        kickedRef.current.delete(id)
      }
      const gone = new Set(ids)
      setSessions((prev) => prev.filter((s) => !gone.has(s.id)))
      setListenMarks((prev) => prev.filter((mark) => !gone.has(mark.sessionId)))
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
            const today = new Date().toISOString().slice(0, 10)
            setListenMarks((prev) =>
              prev.some((mark) => mark.sessionId === id && mark.date === today)
                ? prev
                : [...prev, { sessionId: id, date: today }],
            )
            setSessions((prev) =>
              prev.map((s) => (s.id === id ? { ...s, listens: s.listens + 1 } : s)),
            )
            const listens = await sessionsService.listListenDays(userId)
            if (listens) setListenMarks(listens)
            return
          }
          /** Invité : 1 jour validé max (journal local, sans visualisation) */
          setLocalStats((prev) => {
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

  const value = useMemo(
    () => ({
      sessions,
      sessionsReady,
      listenMarks,
      stats,
      addSession,
      adjustSession,
      removeSession,
      forgetSessions,
      markListened,
      retryGeneration,
    }),
    [
      sessions,
      sessionsReady,
      listenMarks,
      stats,
      addSession,
      adjustSession,
      removeSession,
      forgetSessions,
      markListened,
      retryGeneration,
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
