import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '@/services/auth'
import { supabase } from '@/services/supabase'

const RULES = [
  { label: '8 caractères minimum', test: (p: string) => p.length >= 8 },
  { label: '1 majuscule', test: (p: string) => /[A-Z]/.test(p) },
  { label: '1 caractère spécial', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [hint, setHint] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const ok = RULES.every((rule) => rule.test(password))

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!ok) return
    setBusy(true)
    setHint('')
    try {
      await authService.updatePassword(password)
      setDone(true)
    } catch (err) {
      setHint(err instanceof Error ? err.message : 'Impossible d’enregistrer le mot de passe')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[70dvh] w-full max-w-sm flex-col items-center justify-center px-4 text-center">
      <h1 className="font-display text-3xl text-ink dark:text-cream">Nouveau mot de passe</h1>
      {done ? (
        <>
          <p className="mt-4 text-sm text-ink/70 dark:text-champagne/80">
            C’est enregistré. Tu peux te connecter avec ce mot de passe.
          </p>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mt-6 rounded-full bg-[var(--vs-or)] px-5 py-2.5 text-sm font-semibold text-[var(--vs-nuit)]"
          >
            Continuer
          </button>
        </>
      ) : !ready ? (
        <p className="mt-4 text-sm text-ink/70 dark:text-champagne/80">
          Ouvre le lien reçu par e-mail pour choisir ton mot de passe.
        </p>
      ) : (
        <form onSubmit={(e) => void onSubmit(e)} className="mt-6 w-full space-y-3">
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nouveau mot de passe"
            className="w-full rounded-2xl border border-black/10 bg-transparent px-3.5 py-3 text-center text-base text-ink outline-none dark:border-white/15 dark:text-cream"
          />
          <ul className="space-y-1 text-left text-xs text-ink/60 dark:text-champagne/70">
            {RULES.map((rule) => (
              <li key={rule.label}>{rule.test(password) ? '· ' : '· '}{rule.label}</li>
            ))}
          </ul>
          {hint && <p className="text-xs text-[var(--vs-or)]">{hint}</p>}
          <button
            type="submit"
            disabled={busy || !ok}
            className="w-full rounded-full bg-[var(--vs-or)] py-2.5 text-sm font-semibold text-[var(--vs-nuit)] disabled:opacity-40"
          >
            {busy ? '…' : 'Enregistrer'}
          </button>
        </form>
      )}
    </div>
  )
}
