/** Dictée navigateur (Web Speech) — texte uniquement, aucun fichier audio. */

type SpeechRec = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((ev: SpeechRecEvent) => void) | null
  onerror: ((ev: { error?: string }) => void) | null
  onend: (() => void) | null
}

type SpeechRecEvent = {
  resultIndex: number
  results: ArrayLike<{
    isFinal: boolean
    0: { transcript: string }
  }>
}

function SpeechRecCtor(): (new () => SpeechRec) | null {
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRec
    webkitSpeechRecognition?: new () => SpeechRec
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function canDictate() {
  return Boolean(SpeechRecCtor())
}

export type DictationSession = {
  stop: () => void
}

export function startDictation(opts: {
  onTranscript: (text: string) => void
  onError: (message: string) => void
  onEnd: () => void
}): DictationSession {
  const Ctor = SpeechRecCtor()
  if (!Ctor) {
    opts.onError('La dictée n’est pas dispo sur ce navigateur (essaie Chrome ou Safari).')
    opts.onEnd()
    return { stop: () => {} }
  }

  const rec = new Ctor()
  rec.lang = 'fr-FR'
  rec.continuous = true
  rec.interimResults = true
  rec.maxAlternatives = 1

  let active = true

  rec.onresult = (ev) => {
    let chunk = ''
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const row = ev.results[i]
      if (row?.isFinal) chunk += row[0]?.transcript ?? ''
    }
    const text = chunk.trim()
    if (text) opts.onTranscript(text)
  }

  rec.onerror = (ev) => {
    const code = ev.error ?? ''
    if (code === 'no-speech' || code === 'aborted') return
    active = false
    if (code === 'not-allowed' || code === 'service-not-allowed') {
      opts.onError('Autorise le micro dans le navigateur, puis réessaie.')
    } else if (code === 'network') {
      opts.onError('Dictée indisponible (connexion).')
    } else {
      opts.onError('La dictée s’est arrêtée.')
    }
  }

  rec.onend = () => {
    if (!active) {
      opts.onEnd()
      return
    }
    try {
      rec.start()
    } catch {
      active = false
      opts.onEnd()
    }
  }

  try {
    rec.start()
  } catch {
    active = false
    opts.onError('Impossible de démarrer le micro.')
    opts.onEnd()
  }

  return {
    stop: () => {
      active = false
      try {
        rec.stop()
      } catch {
        opts.onEnd()
      }
    },
  }
}
