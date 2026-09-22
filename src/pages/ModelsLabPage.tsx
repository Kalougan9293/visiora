import { useMemo, useState } from 'react'
import { COMPARE_MODELS, estimateUsd, formatUsd } from '@/data/modelsLab'
import { formatProfileFiche } from '@/lib/profileFiche'
import { useAuth } from '@/context/AuthContext'
import { useSessions } from '@/context/SessionsContext'
import { compareSessionScript } from '@/services/modelsLab'
import { cn } from '@/lib/utils'

export function ModelsLabPage() {
  const { user, configured } = useAuth()
  const { sessions } = useSessions()
  const ready = sessions.filter((s) => Object.keys(s.answers || {}).length > 0)
  const [sessionId, setSessionId] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [scripts, setScripts] = useState<Record<string, { text: string; usage?: string; error?: string }>>(
    {},
  )

  const chosen = ready.find((s) => s.id === sessionId) ?? ready[0]
  const fiche = useMemo(
    () => (chosen ? formatProfileFiche(chosen.answers as Record<string, unknown>) : ''),
    [chosen],
  )

  async function run(modelId: string) {
    if (!chosen) return
    setBusyId(modelId)
    setScripts((prev) => ({ ...prev, [modelId]: { text: '', error: undefined } }))
    try {
      const result = await compareSessionScript(chosen.id, modelId)
      if (!result.ok || !result.script) {
        setScripts((prev) => ({
          ...prev,
          [modelId]: { text: '', error: result.error || 'Pas de script' },
        }))
        return
      }
      const usage = result.usage
        ? `${result.usage.prompt} in · ${result.usage.completion} out`
        : undefined
      setScripts((prev) => ({ ...prev, [modelId]: { text: result.script!, usage } }))
    } catch (err) {
      setScripts((prev) => ({
        ...prev,
        [modelId]: { text: '', error: err instanceof Error ? err.message : 'Erreur' },
      }))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center pb-6 text-center">
      <h1 className="font-display text-3xl tracking-tight text-ink dark:text-cream">Modèles</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink/68 dark:text-champagne/86">
        Même fiche, un modèle à la fois. Le prompt-maître reste côté serveur. Prix API
        indicatifs, sept. 2026 — estimation ~6k in / 4k out pour 15 min.
      </p>

      {!configured && <p className="mt-6 text-sm text-[var(--vs-or)]">Supabase non configuré.</p>}
      {configured && !user && (
        <p className="mt-6 text-sm text-ink/70 dark:text-champagne/85">
          Connecte-toi pour charger une séance.
        </p>
      )}

      {ready.length > 0 && (
        <label className="mt-6 w-full text-left text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/55 dark:text-champagne/70">
          Séance source
          <select
            value={chosen?.id ?? ''}
            onChange={(e) => setSessionId(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-black/10 bg-[var(--vs-surface)] px-3 py-2 text-sm text-ink dark:border-[var(--vs-ardoise)] dark:text-[var(--vs-lunaire)]"
          >
            {ready.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
      )}

      {fiche && (
        <div className="mt-4 w-full text-left">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/55 dark:text-champagne/70">
              Fiche envoyée au modèle
            </p>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(fiche)}
              className="text-[11px] text-[var(--vs-azur)] underline"
            >
              Copier
            </button>
          </div>
          <pre className="max-h-48 overflow-auto rounded-xl border border-black/8 bg-[var(--vs-surface)] p-3 text-left text-[11px] leading-relaxed text-ink/80 dark:border-[var(--vs-ardoise)] dark:text-[var(--vs-lunaire)]">
            {fiche}
          </pre>
        </div>
      )}

      <div className="mt-6 w-full space-y-3">
        {COMPARE_MODELS.map((model) => {
          const result = scripts[model.id]
          return (
            <div
              key={model.id}
              className="rounded-2xl border border-black/8 bg-[var(--vs-surface)] p-4 text-left dark:border-[var(--vs-ardoise)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink dark:text-cream">{model.label}</p>
                  <p className="mt-0.5 text-[11px] text-ink/55 dark:text-champagne/75">{model.role}</p>
                  <p className="mt-1 text-[11px] text-ink/70 dark:text-champagne/80">
                    {formatUsd(model.inputPerM)} / {formatUsd(model.outputPerM)} le MTok
                    {' · '}≈ {formatUsd(estimateUsd(model))} / séance
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!chosen || busyId !== null}
                  onClick={() => void run(model.id)}
                  className={cn(
                    'shrink-0 rounded-full bg-[var(--vs-or)] px-3 py-1.5 text-[11px] font-medium text-[var(--vs-nuit)] disabled:opacity-40',
                  )}
                >
                  {busyId === model.id ? '…' : 'Générer'}
                </button>
              </div>
              {result?.error && (
                <p className="mt-3 text-xs text-[var(--vs-or)]">{result.error}</p>
              )}
              {result?.text && (
                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-ink/45">
                      Script brut{result.usage ? ` · ${result.usage}` : ''}
                    </p>
                    <button
                      type="button"
                      onClick={() => void navigator.clipboard.writeText(result.text)}
                      className="text-[11px] text-[var(--vs-azur)] underline"
                    >
                      Copier
                    </button>
                  </div>
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-black/[0.04] p-3 text-[11px] leading-relaxed text-ink/80 dark:bg-white/[0.04] dark:text-[var(--vs-lunaire)]">
                    {result.text}
                  </pre>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
