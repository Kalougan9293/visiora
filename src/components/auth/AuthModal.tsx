import { useEffect, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, Eye, EyeOff, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { authService } from '@/services/auth'
import { AI_DISCLOSURE } from '@/data/uiCopy'
import { cn } from '@/lib/utils'

type Mode = 'login' | 'signup'
type SignupStep = 1 | 2

type AuthModalProps = {
  open: boolean
  onClose: () => void
}

const PASS_RULES = [
  { id: 'upper', label: '1 majuscule', test: (p: string) => /[A-Z]/.test(p) },
  { id: 'special', label: '1 caractère spécial', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
  { id: 'length', label: '8 caractères minimum', test: (p: string) => p.length >= 8 },
] as const

function passwordOk(p: string) {
  return PASS_RULES.every((r) => r.test(p))
}

function mapAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  const lower = msg.toLowerCase()
  if (lower.includes('invalid login')) return 'Identifiants incorrects'
  if (lower.includes('already registered') || lower.includes('already been registered'))
    return 'Compte déjà existant'
  if (lower.includes('non configuré') || lower.includes('supabase'))
    return 'Supabase non configuré'
  if (lower.includes('password')) return 'Mot de passe invalide'
  return msg.slice(0, 120) || 'Erreur'
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const { signIn, signUp, configured } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [signupStep, setSignupStep] = useState<SignupStep>(1)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPass, setLoginPass] = useState('')
  const [firstName, setFirstName] = useState('')
  const [email, setEmail] = useState('')
  const [signupPass, setSignupPass] = useState('')
  const [acceptCgu, setAcceptCgu] = useState(false)
  const [shareSessions, setShareSessions] = useState(false)
  const [hint, setHint] = useState('')
  const [busy, setBusy] = useState(false)
  const [showLoginPass, setShowLoginPass] = useState(false)
  const [showSignupPass, setShowSignupPass] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) {
      setMode('login')
      setSignupStep(1)
      setHint('')
      setSignupPass('')
      setAcceptCgu(false)
      setBusy(false)
      setShowLoginPass(false)
      setShowSignupPass(false)
    }
  }, [open])

  function switchMode(next: Mode) {
    setMode(next)
    setSignupStep(1)
    setHint('')
    setSignupPass('')
    setAcceptCgu(false)
    setShowLoginPass(false)
    setShowSignupPass(false)
  }

  async function onLogin(e: FormEvent) {
    e.preventDefault()
    if (!loginEmail.trim() || !loginPass) {
      setHint('Champs requis')
      return
    }
    if (!configured) {
      setHint('Supabase non configuré')
      return
    }
    setBusy(true)
    setHint('')
    try {
      await signIn(loginEmail, loginPass)
      onClose()
    } catch (err) {
      setHint(mapAuthError(err))
    } finally {
      setBusy(false)
    }
  }

  function onSignupStep1(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) {
      setHint('Indique ton e-mail')
      return
    }
    setHint('')
    setSignupStep(2)
  }

  async function onSignupStep2(e: FormEvent) {
    e.preventDefault()
    if (!signupPass || !passwordOk(signupPass)) {
      setHint('Mot de passe invalide')
      return
    }
    if (!acceptCgu) {
      setHint('Accepte les CGU pour continuer')
      return
    }
    if (!configured) {
      setHint('Supabase non configuré')
      return
    }
    setBusy(true)
    setHint('')
    try {
      const { needsEmailConfirm } = await signUp({
        email,
        password: signupPass,
        firstName,
        cguAccepted: acceptCgu,
        shareSessions,
      })
      if (needsEmailConfirm) {
        setHint('Compte créé — vérifie ton e-mail')
        setBusy(false)
        return
      }
      onClose()
    } catch (err) {
      setHint(mapAuthError(err))
    } finally {
      setBusy(false)
    }
  }

  const inputClass = cn(
    'w-full rounded-2xl border px-3.5 py-3 text-left text-base outline-none transition',
    'border-[var(--vs-bordure)] bg-[var(--vs-surface)] text-ink placeholder:text-ink/30 focus:border-[var(--vs-azur)]/50 focus:ring-2 focus:ring-[var(--vs-azur)]/12 dark:text-[var(--vs-lunaire)] dark:placeholder:text-[var(--vs-brume)]',
  )

  const passwordInputClass = cn(inputClass, 'pr-11')

  const eyeBtnClass = cn(
    'absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full transition-colors',
    'text-ink/40 hover:bg-black/5 hover:text-ink/70 dark:text-champagne/60 dark:hover:bg-white/5 dark:hover:text-champagne',
  )

  const labelClass = cn(
    'mb-1.5 block text-left text-[10px] font-semibold uppercase tracking-[0.16em]',
    'text-ink/55 dark:text-champagne/70',
  )

  const linkClass = cn(
    'text-center text-xs transition',
    'text-ink/55 hover:text-[var(--vs-azur)] dark:text-[var(--vs-brume)] dark:hover:text-[var(--vs-azur)]',
  )

  const title =
    mode === 'login'
      ? 'Connexion'
      : signupStep === 1
        ? 'Créer un compte'
        : 'Sécuriser le compte'

  const subtitle =
    mode === 'login'
      ? 'Retrouve tes séances et ton suivi.'
      : signupStep === 1
        ? 'Quelques infos pour personnaliser Visiora.'
        : 'Choisis un mot de passe solide.'

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Fermer"
            className={cn(
              'absolute inset-0 backdrop-blur-sm',
              'bg-ink/50 dark:bg-black/60',
            )}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              'relative z-10 w-full max-w-[22.5rem] overflow-hidden rounded-[1.5rem] border p-6 sm:p-7',
              'border-[var(--vs-bordure)] bg-[var(--vs-surface)]',
            )}
          >
            <button
              type="button"
              onClick={onClose}
              className={cn(
                'absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full transition',
                'text-ink/40 hover:bg-black/5 hover:text-ink dark:text-cream/50 dark:hover:bg-white/10 dark:hover:text-cream',
              )}
              aria-label="Fermer"
            >
              <X size={16} />
            </button>

            {mode === 'signup' && (
              <div className="mb-5 flex items-center justify-center gap-2">
                {[1, 2].map((n) => (
                  <span
                    key={n}
                    className={cn(
                      'h-1 rounded-full transition-all duration-300',
                      n === signupStep ? 'w-8' : 'w-3',
                      n <= signupStep ? 'bg-[var(--vs-azur)]' : 'bg-black/12 dark:bg-[var(--vs-ardoise)]',
                    )}
                  />
                ))}
              </div>
            )}

            <div className="text-center">
              <h2
                className={cn(
                  'text-xl tracking-tight sm:text-[1.35rem]',
                  'font-display text-ink dark:text-cream',
                )}
              >
                {title}
              </h2>
              <p
                className={cn(
                  'mt-1.5 text-xs leading-relaxed',
                  'text-ink/50 dark:text-champagne/65',
                )}
              >
                {subtitle}
              </p>
            </div>

            {mode === 'login' ? (
              <form onSubmit={onLogin} className="mt-6 space-y-3.5">
                <Field label="Mail" labelClass={labelClass} htmlFor="auth-user">
                  <input
                    id="auth-user"
                    type="email"
                    autoComplete="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className={inputClass}
                    disabled={busy}
                  />
                </Field>
                <Field label="Mot de passe" labelClass={labelClass} htmlFor="auth-pass">
                  <div className="relative">
                    <input
                      id="auth-pass"
                      type={showLoginPass ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={loginPass}
                      onChange={(e) => setLoginPass(e.target.value)}
                      className={passwordInputClass}
                      disabled={busy}
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={showLoginPass ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                      onClick={() => setShowLoginPass((v) => !v)}
                      className={eyeBtnClass}
                    >
                      {showLoginPass ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </Field>

                <button
                  type="button"
                  className={cn(linkClass, 'w-full')}
                  onClick={() => {
                    if (!loginEmail.trim()) {
                      setHint('Indique ton e-mail')
                      return
                    }
                    setBusy(true)
                    setHint('')
                    void authService
                      .requestPasswordReset(loginEmail)
                      .then(() => setHint('Un e-mail vient de partir pour choisir un nouveau mot de passe.'))
                      .catch((err: unknown) => setHint(mapAuthError(err)))
                      .finally(() => setBusy(false))
                  }}
                >
                  Mot de passe oublié ?
                </button>
                <Hint text={hint} />
                <PrimaryButton label={busy ? '…' : 'Se connecter'} disabled={busy} />
                <button type="button" onClick={() => switchMode('signup')} className={cn(linkClass, 'w-full pt-1')}>
                  Pas de compte ? Créer un compte
                </button>
              </form>
            ) : (
              <AnimatePresence mode="wait">
                {signupStep === 1 ? (
                  <motion.form
                    key="signup-1"
                    onSubmit={onSignupStep1}
                    className="mt-6 space-y-3.5"
                    initial={{ opacity: 0, x: 14 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -14 }}
                    transition={{ duration: 0.22 }}
                  >
                    <Field label="Prénom (facultatif)" labelClass={labelClass} htmlFor="auth-first">
                      <input
                        id="auth-first"
                        type="text"
                        autoComplete="given-name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Mail" labelClass={labelClass} htmlFor="auth-email">
                      <input
                        id="auth-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={inputClass}
                      />
                    </Field>

                    <Hint text={hint} />
                    <PrimaryButton
                      label="Suivant"
                      icon={<ArrowRight size={16} strokeWidth={2.25} />}
                    />
                    <button
                      type="button"
                      onClick={() => switchMode('login')}
                      className={cn(linkClass, 'w-full pt-1')}
                    >
                      Déjà un compte ?
                    </button>
                  </motion.form>
                ) : (
                  <motion.form
                    key="signup-2"
                    onSubmit={onSignupStep2}
                    className="mt-6 space-y-3.5"
                    initial={{ opacity: 0, x: 14 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -14 }}
                    transition={{ duration: 0.22 }}
                  >
                    <Field label="Mot de passe" labelClass={labelClass} htmlFor="auth-signup-pass">
                      <div className="relative">
                        <input
                          id="auth-signup-pass"
                          type={showSignupPass ? 'text' : 'password'}
                          autoComplete="new-password"
                          value={signupPass}
                          onChange={(e) => setSignupPass(e.target.value)}
                          className={passwordInputClass}
                          disabled={busy}
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          aria-label={
                            showSignupPass ? 'Masquer le mot de passe' : 'Afficher le mot de passe'
                          }
                          onClick={() => setShowSignupPass((v) => !v)}
                          className={eyeBtnClass}
                        >
                          {showSignupPass ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </Field>

                    <ul className="space-y-2 rounded-2xl px-1 py-0.5">
                      {PASS_RULES.map((rule) => {
                        const ok = rule.test(signupPass)
                        return (
                          <li
                            key={rule.id}
                            className={cn(
                              'flex items-center gap-2.5 text-[12px] leading-snug transition-colors',
                              ok
                                ? 'font-medium text-[var(--vs-azur)]'
                                : 'text-ink/45 dark:text-[var(--vs-brume)]',
                            )}
                          >
                            <span
                              className={cn(
                                'flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors',
                                ok ? 'bg-[var(--vs-azur)] text-[var(--vs-nuit)]' : 'bg-black/[0.06] dark:bg-[var(--vs-abysse)]',
                              )}
                            >
                              {ok ? <Check size={10} strokeWidth={3} /> : null}
                            </span>
                            {rule.label}
                          </li>
                        )
                      })}
                    </ul>

                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-2.5 rounded-2xl px-0.5 text-left text-[11px] leading-snug sm:text-xs',
                        'text-ink/60 dark:text-champagne/70',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={acceptCgu}
                        onChange={(e) => setAcceptCgu(e.target.checked)}
                        className={cn(
                          'mt-0.5 h-3.5 w-3.5 shrink-0 rounded border accent-[var(--vs-azur)]',
                          'border-black/20 dark:border-white/25',
                        )}
                        disabled={busy}
                      />
                      <span>J&apos;accepte les CGU et la politique de confidentialité</span>
                    </label>

                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-2.5 rounded-2xl px-0.5 text-left text-[11px] leading-snug sm:text-xs',
                        'text-ink/60 dark:text-champagne/70',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={shareSessions}
                        onChange={(e) => setShareSessions(e.target.checked)}
                        className={cn(
                          'mt-0.5 h-3.5 w-3.5 shrink-0 rounded border accent-[var(--vs-azur)]',
                          'border-black/20 dark:border-white/25',
                        )}
                        disabled={busy}
                      />
                      <span>{AI_DISCLOSURE.shareCheckbox}</span>
                    </label>

                    <Hint text={hint} />
                    <PrimaryButton
                      label={busy ? '…' : 'Créer mon compte'}
                      disabled={busy}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSignupStep(1)
                        setHint('')
                      }}
                      className={cn(linkClass, 'w-full pt-1')}
                    >
                      Retour
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Field({
  label,
  labelClass,
  htmlFor,
  children,
}: {
  label: string
  labelClass: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="text-left">
      <label className={labelClass} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Hint({ text }: { text: string }) {
  if (!text) return null
  return <p className="text-center text-xs text-[var(--vs-or)]">{text}</p>
}

function PrimaryButton({
  label,
  disabled,
  icon,
}: {
  label: string
  disabled?: boolean
  icon?: React.ReactNode
}) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[var(--vs-or)] px-4 py-3 text-sm font-semibold text-[var(--vs-nuit)] transition hover:brightness-105 disabled:opacity-60"
    >
      {label}
      {icon}
    </button>
  )
}
