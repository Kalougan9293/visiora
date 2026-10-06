import { useEffect, useState } from 'react'
import { Hourglass } from 'lucide-react'
import { voiceCatalogService, type VoiceSlot } from '@/services/voiceCatalog'

const SAVE_HOLD_MS = 9000

type Draft = VoiceSlot & { nextVoiceId: string; draft?: boolean }

export function VoiceStudio() {
  const [slots, setSlots] = useState<Draft[]>([])
  const [missing, setMissing] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [bedFiles, setBedFiles] = useState<Record<string, File | null>>({})

  useEffect(() => {
    void voiceCatalogService.list(true).then((rows) => {
      setSlots(rows.map((row) => ({ ...row, nextVoiceId: row.elevenVoiceId })))
      setMissing(rows.length === 0)
    })
  }, [])

  const patch = (slot: string, next: Partial<Draft>) => {
    setSlots((rows) => rows.map((row) => (row.slot === slot ? { ...row, ...next } : row)))
  }

  const addVoice = () => {
    setError('')
    const slot = `v${Date.now()}`
    setSlots((rows) => [
      ...rows,
      {
        slot,
        label: '',
        elevenVoiceId: '',
        nextVoiceId: '',
        bed: '',
        bedLabel: '',
        previewUrl: null,
        dryUrl: null,
        draft: true,
      },
    ])
  }

  const saveVoice = async (row: Draft) => {
    const file = bedFiles[row.slot]
    const voiceId = row.nextVoiceId.trim() || row.elevenVoiceId
    if (!row.label.trim()) {
      setError('Indique un prénom')
      return
    }
    if (!/^[A-Za-z0-9]{10,40}$/.test(voiceId)) {
      setError('Indique l’identifiant de la voix')
      return
    }
    if (row.draft && !file) {
      setError('Ajoute un fichier de fond')
      return
    }
    setBusy(row.slot)
    setError('')
    const started = Date.now()
    try {
      const saved = file
        ? await voiceCatalogService.uploadBed(file, { ...row, label: row.label, elevenVoiceId: voiceId })
        : await voiceCatalogService.save({
            slot: row.slot,
            label: row.label,
            elevenVoiceId: voiceId,
            bed: row.bed,
            bedLabel: row.bedLabel,
          })
      setSlots((rows) =>
        rows.map((item) =>
          item.slot === saved.slot ? { ...saved, nextVoiceId: saved.elevenVoiceId, draft: false } : item,
        ),
      )
      if (file) setBedFiles((files) => ({ ...files, [row.slot]: null }))
      const wait = SAVE_HOLD_MS - (Date.now() - started)
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible')
    } finally {
      setBusy(null)
    }
  }

  if (missing) {
    return (
      <p className="mt-6 text-center text-[12px] leading-relaxed text-black dark:text-white">
        Les voix s’affichent après avoir exécuté supabase/voice_slots.sql dans Supabase.
      </p>
    )
  }

  return (
    <div className="mt-4 space-y-2">
      <p className="text-center text-[12px] leading-snug text-black dark:text-white">
        Chaque voix a son fond. Le niveau se cale à l’envoi.
      </p>
      {slots.map((row) => {
        const picked = bedFiles[row.slot]
        return (
          <form
            key={row.slot}
            className="mx-auto w-full max-w-lg rounded-xl border border-white/15 bg-white/[0.04] px-2.5 py-2"
            onSubmit={(event) => {
              event.preventDefault()
              void saveVoice(row)
            }}
          >
            <div className="grid grid-cols-[5.75rem_6.5rem_minmax(13.5rem,1fr)_auto] items-end gap-x-1.5 gap-y-1">
              <span className="text-center text-[10px] uppercase tracking-[0.12em] text-black/60 dark:text-white/60">
                Prénom
              </span>
              <span className="text-center text-[10px] uppercase tracking-[0.12em] text-black/60 dark:text-white/60">
                Fond
              </span>
              <span className="px-1 text-[10px] uppercase tracking-[0.12em] text-black/60 dark:text-white/60">
                Voix
              </span>
              <span />
              <input
                value={row.label}
                maxLength={16}
                onChange={(event) => patch(row.slot, { label: event.target.value })}
                className="h-7 w-full rounded-full border border-white/15 bg-transparent px-2 text-center text-[13px] text-black outline-none dark:text-white"
                aria-label={`Prénom pour ${row.slot}`}
              />
              <label className="flex h-7 cursor-pointer items-center justify-center rounded-full border border-white/15 px-2 text-center text-[12px] text-black/80 dark:text-white/80">
                <span className="truncate">{picked ? picked.name.replace(/\.[^.]+$/, '') : 'Fichier'}</span>
                <input
                  key={`${row.slot}-${row.bed}`}
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.ogg"
                  onChange={(event) =>
                    setBedFiles((files) => ({ ...files, [row.slot]: event.target.files?.[0] ?? null }))
                  }
                  className="sr-only"
                />
              </label>
              <input
                value={row.nextVoiceId}
                onChange={(event) => patch(row.slot, { nextVoiceId: event.target.value.trim() })}
                aria-label={`Voix ElevenLabs pour ${row.label || row.slot}`}
                className="h-7 w-full rounded-full border border-white/15 bg-transparent px-2.5 text-[12px] text-black outline-none dark:text-white"
                spellCheck={false}
              />
              <button
                type="submit"
                disabled={busy !== null}
                aria-label={busy === row.slot ? 'Enregistrement en cours' : 'OK'}
                className={`flex h-7 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--vs-or)] text-[12px] font-semibold text-[#020c25] ${busy === row.slot ? '' : 'disabled:opacity-40'}`}
              >
                {busy === row.slot ? (
                  <Hourglass size={14} className="animate-spin [animation-duration:1.8s]" />
                ) : (
                  'OK'
                )}
              </button>
            </div>
          </form>
        )
      })}
      <button
        type="button"
        onClick={addVoice}
        disabled={busy !== null}
        className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-lg leading-none text-black disabled:opacity-40 dark:text-white"
        aria-label="Ajouter une voix"
      >
        +
      </button>
      {error && <p className="text-center text-xs text-black dark:text-white">{error}</p>}
    </div>
  )
}
