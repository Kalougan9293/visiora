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
import { useSessions } from '@/context/SessionsContext'
import { hasListenedEnough } from '@/lib/listenThreshold'
import { metricsService, type ListenSample } from '@/services/metrics'

export type PlaybackStart = {
  sessionId: string
  title: string
  src: string
}

type PlaybackValue = {
  sessionId: string | null
  title: string
  playing: boolean
  ended: boolean
  current: number
  duration: number
  start: (item: PlaybackStart) => Promise<void>
  toggle: () => Promise<void>
  seek: (seconds: number) => void
}

const PlaybackContext = createContext<PlaybackValue | null>(null)

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const { sessions, markListened } = useSessions()
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const countedRef = useRef(false)
  const playIdRef = useRef<string | null>(null)
  const maxSecondsRef = useRef(0)
  const chainRef = useRef(Promise.resolve())
  const playGenRef = useRef(0)
  const lastSentRef = useRef(0)
  const ignorePauseRef = useRef(false)
  const markRef = useRef(markListened)
  markRef.current = markListened

  const [sessionId, setSessionId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [playing, setPlaying] = useState(false)
  const [ended, setEnded] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)

  const remember = useCallback((sample: ListenSample, force = false) => {
    const id = sessionIdRef.current
    if (!id) return
    maxSecondsRef.current = Math.max(maxSecondsRef.current, sample.current)
    const maxSeconds = maxSecondsRef.current
    const now = Date.now()
    if (!force && !sample.ended && now - lastSentRef.current < 5000) return
    lastSentRef.current = now
    const gen = playGenRef.current
    chainRef.current = chainRef.current
      .then(async () => {
        if (playGenRef.current !== gen) return
        if (!playIdRef.current) playIdRef.current = await metricsService.startPlay(id)
        if (playGenRef.current !== gen || !playIdRef.current) return
        await metricsService.updatePlay(playIdRef.current, sample, maxSeconds)
      })
      .catch(() => {})
  }, [])

  const beginMetrics = useCallback((id: string) => {
    const gen = ++playGenRef.current
    playIdRef.current = null
    maxSecondsRef.current = 0
    lastSentRef.current = 0
    chainRef.current = chainRef.current
      .then(async () => {
        const playId = await metricsService.startPlay(id)
        if (playGenRef.current === gen) playIdRef.current = playId
      })
      .catch(() => {})
  }, [])

  const markIfEnough = useCallback((el: HTMLAudioElement, atEnd: boolean) => {
    const id = sessionIdRef.current
    if (!id || countedRef.current) return
    if (!hasListenedEnough(el.currentTime, el.duration, atEnd)) return
    countedRef.current = true
    markRef.current(id)
  }, [])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return

    const sync = () => {
      const length = Number.isFinite(el.duration) ? el.duration : 0
      const now = Number.isFinite(el.currentTime) ? el.currentTime : 0
      setCurrent(now)
      setDuration(length)
    }
    const onTime = () => {
      sync()
      markIfEnough(el, false)
      const length = Number.isFinite(el.duration) ? el.duration : 0
      remember({ current: el.currentTime, duration: length, ended: false })
    }
    const onEnd = () => {
      setPlaying(false)
      setEnded(true)
      sync()
      markIfEnough(el, true)
      const length = Number.isFinite(el.duration) ? el.duration : 0
      remember({ current: length, duration: length, ended: true }, true)
    }
    const onPlay = () => {
      setPlaying(true)
      setEnded(false)
    }
    const onPause = () => {
      if (ignorePauseRef.current) return
      if (!el.ended) setPlaying(false)
      const length = Number.isFinite(el.duration) ? el.duration : 0
      remember({ current: el.currentTime, duration: length, ended: el.ended }, true)
    }
    const onMeta = () => sync()

    el.addEventListener('timeupdate', onTime)
    el.addEventListener('ended', onEnd)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('durationchange', onMeta)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('ended', onEnd)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('durationchange', onMeta)
    }
  }, [markIfEnough, remember])

  useEffect(() => {
    const onForeignPlay = (event: Event) => {
      const node = event.target
      if (!(node instanceof HTMLAudioElement) || node === audioRef.current) return
      if (audioRef.current && !audioRef.current.paused) audioRef.current.pause()
    }
    document.addEventListener('play', onForeignPlay, true)
    return () => document.removeEventListener('play', onForeignPlay, true)
  }, [])

  useEffect(() => {
    if (!sessionId) return
    const found = sessions.find((session) => session.id === sessionId)
    if (!found) {
      const el = audioRef.current
      el?.pause()
      if (el) el.removeAttribute('src')
      sessionIdRef.current = null
      setSessionId(null)
      setPlaying(false)
      setTitle('')
      return
    }
    if (found.title !== title) setTitle(found.title)
  }, [sessions, sessionId, title])

  const start = useCallback(
    async (item: PlaybackStart) => {
      const el = audioRef.current
      if (!el || !item.src) return
      const same = sessionIdRef.current === item.sessionId && Boolean(el.getAttribute('src'))
      if (!same) {
        if (sessionIdRef.current && el.getAttribute('src') && playIdRef.current) {
          const playId = playIdRef.current
          const length = Number.isFinite(el.duration) ? el.duration : 0
          const now = Number.isFinite(el.currentTime) ? el.currentTime : 0
          const maxSeconds = Math.max(maxSecondsRef.current, now)
          chainRef.current = chainRef.current
            .then(() => metricsService.updatePlay(playId, { current: now, duration: length, ended: false }, maxSeconds))
            .catch(() => {})
        }
        sessionIdRef.current = item.sessionId
        countedRef.current = false
        setSessionId(item.sessionId)
        setTitle(item.title)
        setEnded(false)
        setCurrent(0)
        setDuration(0)
        ignorePauseRef.current = true
        el.src = item.src
        ignorePauseRef.current = false
        beginMetrics(item.sessionId)
      } else if (!el.paused && !el.ended) {
        el.pause()
        return
      } else {
        const fresh = el.ended || el.currentTime < 0.4
        if (el.ended || (el.duration && el.currentTime >= el.duration - 0.05)) {
          el.currentTime = 0
          countedRef.current = false
          setEnded(false)
        }
        if (fresh) beginMetrics(item.sessionId)
      }
      document.querySelectorAll('audio').forEach((node) => {
        if (node !== el) node.pause()
      })
      try {
        await el.play()
      } catch (err) {
        console.warn('[audio] play failed', err)
        setPlaying(false)
      }
    },
    [beginMetrics],
  )

  const toggle = useCallback(async () => {
    const id = sessionIdRef.current
    const el = audioRef.current
    if (!id || !el || !el.getAttribute('src')) return
    await start({ sessionId: id, title, src: el.src })
  }, [start, title])

  const seek = useCallback((seconds: number) => {
    const el = audioRef.current
    if (!el || !Number.isFinite(el.duration) || el.duration <= 0) return
    const next = Math.min(el.duration, Math.max(0, seconds))
    el.currentTime = next
    setCurrent(next)
    if (next < el.duration - 0.05) setEnded(false)
  }, [])

  const value = useMemo(
    () => ({ sessionId, title, playing, ended, current, duration, start, toggle, seek }),
    [sessionId, title, playing, ended, current, duration, start, toggle, seek],
  )

  return (
    <PlaybackContext.Provider value={value}>
      <audio ref={audioRef} className="hidden" preload="metadata" playsInline />
      {children}
    </PlaybackContext.Provider>
  )
}

export function usePlayback() {
  const value = useContext(PlaybackContext)
  if (!value) throw new Error('Lecture indisponible')
  return value
}
