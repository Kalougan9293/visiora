import { useEffect, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useVariant } from '@/context/VariantContext'
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
  const { isAqua } = useVariant()
  const { signIn, signUp, configured } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [signupStep, setSignupStep] = useState<SignupStep>(1)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPass, setLoginPass] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [signupPass, setSignupPass] = useState('')
  const [acceptCgu, setAcceptCgu] = useState(false)
  const [hint, setHint] = useState('')
  const [busy, setBusy] = useState(false)

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
    }
  }, [open])

  function switchMode(next: Mode) {
    setMode(next)
    setSignupStep(1)
    setHint('')
    setSignupPass('')
    setAcceptCgu(false)
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
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setHint('Champs requis')
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
      setHint('Acceptez les CGU pour continuer')
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
        lastName,
        cguAccepted: acceptCgu,
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
    'w-full rounded-xl border px-3 py-2.5 text-center text-sm outline-none transition',
    isAqua
      ? 'border-white/20 bg-white/10 text-[#e8f7f9] placeholder:text-[#b8e4ea]/45 focus:border-[#7ed4df]/55 focus:ring-2 focus:ring-[#7ed4df]/15'
      : 'border-black/12 bg-black/[0.03] text-ink placeholder:text-ink/35 focus:border-olive/45 focus:ring-2 focus:ring-olive/15 dark:border-white/15 dark:bg-white/5 dark:text-cream dark:placeholder:text-champagne/40 dark:focus:border-gold/40 dark:focus:ring-gold/15',
  )

  const labelClass = cn(
    'mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em]',
    isAqua ? 'text-[#7ed4df]' : 'text-ink/50 dark:text-champagne/60',
  )

  const linkClass = cn(
    'mx-auto block text-center text-xs transition',
    isAqua
      ? 'text-[#b8e4ea]/75 hover:text-[#7ed4df]'
      : 'text-ink/55 hover:text-olive dark:text-champagne/65 dark:hover:text-gold',
  )

  const title =
    mode === 'login' ? 'Connexion' : signupStep === 1 ? 'Compte' : 'Mot de passe'

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
              isAqua ? 'bg-[#06262c]/75' : 'bg-ink/50 dark:bg-black/60',
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
              'relative z-10 w-full max-w-[22rem] rounded-[1.35rem] border p-6 shadow-2xl',
              isAqua
                ? 'aqua-glass border-white/20'
                : 'border-black/10 bg-cream dark:border-white/12 dark:bg-ink-elevated',
            )}
            style={isAqua ? { fontFamily: 'var(--font-aqua-sans)' } : undefined}
          >
            <button
              type="button"
              onClick={onClose}
              className={cn(
                'absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border transition',
                isAqua
                  ? 'border-white/20 text-[#e8f7f9]/80 hover:bg-white/10'
                  : 'border-black/10 text-ink/60 hover:bg-black/5 dark:border-white/15 dark:text-cream/70 dark:hover:bg-white/10',
              )}
              aria-label="Fermer"
            >
              <X size={15} />
            </button>

            <h2
              className={cn(
                'text-center text-xl tracking-tight',
                isAqua ? 'text-[#f4fcfd]' : 'font-display text-ink dark:text-cream',
              )}
              style={
                isAqua
                  ? { fontFamily: 'var(--font-aqua-display)', fontWeight: 450 }
                  : undefined
              }
            >
              {title}
            </h2>

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
                  <input
                    id="auth-pass"
                    type="password"
                    autoComplete="current-password"
                    value={loginPass}
                    onChange={(e) => setLoginPass(e.target.value)}
                    className={inputClass}
                    disabled={busy}
                  />
                </Field>

                <Hint text={hint} isAqua={isAqua} />
                <SubmitButton isAqua={isAqua} label={busy ? '…' : 'OK'} disabled={busy} />
                <button type="button" onClick={() => switchMode('signup')} className={linkClass}>
                  Pas de compte ?
                </button>
              </form>
            ) : (
              <AnimatePresence mode="wait">
                {signupStep === 1 ? (
                  <motion.form
                    key="signup-1"
                    onSubmit={onSignupStep1}
                    className="mt-6 space-y-3"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.22 }}
                  >
                    <Field label="Prénom" labelClass={labelClass} htmlFor="auth-first">
                      <input
                        id="auth-first"
                        type="text"
                        autoComplete="given-name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Nom" labelClass={labelClass} htmlFor="auth-last">
                      <input
                        id="auth-last"
                        type="text"
                        autoComplete="family-name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
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

                    <Hint text={hint} isAqua={isAqua} />
                    <BasicButton isAqua={isAqua} label="Suivant" />
                    <button type="button" onClick={() => switchMode('login')} className={linkClass}>
                      Déjà un compte ?
                    </button>
                  </motion.form>
                ) : (
                  <motion.form
                    key="signup-2"
                    onSubmit={onSignupStep2}
                    className="mt-6 space-y-3"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.22 }}
                  >
                    <Field label="Mot de passe" labelClass={labelClass} htmlFor="auth-signup-pass">
                      <input
                        id="auth-signup-pass"
                        type="password"
                        autoComplete="new-password"
                        value={signupPass}
                        onChange={(e) => setSignupPass(e.target.value)}
                        className={inputClass}
                        disabled={busy}
                      />
                    </Field>

                    <ul className="mx-auto mt-1 w-fit space-y-2.5 text-left">
                      {PASS_RULES.map((rule) => {
                        const ok = rule.test(signupPass)
                        return (
                          <li
                            key={rule.id}
                            className={cn(
                              'flex items-center gap-2.5 text-[13px] leading-snug transition-colors sm:text-sm',
                              ok
                                ? 'font-medium text-emerald-500'
                                : isAqua
                                  ? 'text-[#b8e4ea]/70'
                                  : 'text-ink/55 dark:text-champagne/60',
                            )}
                          >
                            <span
                              className={cn(
                                'flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors',
                                ok
                                  ? 'bg-emerald-500 text-white'
                                  : isAqua
                                    ? 'border border-white/25 bg-transparent'
                                    : 'border border-black/15 bg-transparent dark:border-white/20',
                              )}
                            >
                              {ok ? <Check size={12} strokeWidth={3} /> : null}
                            </span>
                            {rule.label}
                          </li>
                        )
                      })}
                    </ul>

                    <label
                      className={cn(
                        'mx-auto flex max-w-[16rem] cursor-pointer items-start gap-2.5 pt-1 text-left text-[11px] leading-snug sm:text-xs',
                        isAqua ? 'text-[#b8e4ea]/75' : 'text-ink/60 dark:text-champagne/65',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={acceptCgu}
                        onChange={(e) => setAcceptCgu(e.target.checked)}
                        className={cn(
                          'mt-0.5 h-3.5 w-3.5 shrink-0 rounded border accent-emerald-500',
                          isAqua ? 'border-white/30' : 'border-black/25 dark:border-white/25',
                        )}
                        disabled={busy}
                      />
                      <span>
                        J&apos;accepte les CGU et la politique de confidentialité
                      </span>
                    </label>

                    <Hint text={hint} isAqua={isAqua} />
                    <SubmitButton isAqua={isAqua} label={busy ? '…' : 'Créer'} disabled={busy} />
                    <button
                      type="button"
                      onClick={() => {
                        setSignupStep(1)
                        setHint('')
                      }}
                      className={linkClass}
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
    <div>
      <label className={labelClass} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  )
}

function Hint({ text, isAqua }: { text: string; isAqua: boolean }) {
  if (!text) return null
  return (
    <p
      className={cn(
        'text-center text-xs',
        isAqua ? 'text-[#f0a0a0]' : 'text-red-600 dark:text-red-400',
      )}
    >
      {text}
    </p>
  )
}

function BasicButton({ isAqua, label }: { isAqua: boolean; label: string }) {
  return (
    <button
      type="submit"
      className={cn(
        'mt-1 w-full rounded-xl border px-4 py-2.5 text-sm font-medium transition',
        isAqua
          ? 'border-white/25 bg-white/10 text-[#e8f7f9] hover:bg-white/15'
          : 'border-black/12 bg-black/[0.04] text-ink hover:bg-black/[0.07] dark:border-white/15 dark:bg-white/5 dark:text-cream dark:hover:bg-white/10',
      )}
    >
      {label}
    </button>
  )
}

function SubmitButton({
  isAqua,
  label,
  disabled,
}: {
  isAqua: boolean
  label: string
  disabled?: boolean
}) {
  if (isAqua) {
    return (
      <button
        type="submit"
        disabled={disabled}
        className="aqua-cta mt-1 w-full !py-2.5 text-sm disabled:opacity-60"
      >
        <span>{label}</span>
      </button>
    )
  }

  return (
    <button
      type="submit"
      disabled={disabled}
      className="mt-1 w-full rounded-full bg-olive px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-olive/90 disabled:opacity-60 dark:bg-gold dark:text-ink dark:hover:bg-gold-bright"
    >
      {label}
    </button>
  )
}
