import { useEffect, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Check, Eye, EyeOff, X } from 'lucide-react'
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
    'w-full rounded-2xl border px-3.5 py-3 text-left text-base outline-none transition',
    isAqua
      ? 'border-white/15 bg-white/[0.07] text-[#e8f7f9] placeholder:text-[#b8e4ea]/40 focus:border-[#7ed4df]/50 focus:bg-white/[0.1] focus:ring-2 focus:ring-[#7ed4df]/12'
      : 'border-black/10 bg-white/80 text-ink placeholder:text-ink/30 focus:border-olive/40 focus:ring-2 focus:ring-olive/12 dark:border-white/12 dark:bg-white/[0.06] dark:text-cream dark:placeholder:text-champagne/35 dark:focus:border-gold/35 dark:focus:ring-gold/12',
  )

  const passwordInputClass = cn(inputClass, 'pr-11')

  const eyeBtnClass = cn(
    'absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full transition-colors',
    isAqua
      ? 'text-[#b8e4ea]/70 hover:bg-white/10 hover:text-[#7ed4df]'
      : 'text-ink/40 hover:bg-black/5 hover:text-ink/70 dark:text-champagne/60 dark:hover:bg-white/5 dark:hover:text-champagne',
  )

  const labelClass = cn(
    'mb-1.5 block text-left text-[10px] font-semibold uppercase tracking-[0.16em]',
    isAqua ? 'text-[#7ed4df]/90' : 'text-ink/55 dark:text-champagne/70',
  )

  const linkClass = cn(
    'text-center text-xs transition',
    isAqua
      ? 'text-[#b8e4ea]/70 hover:text-[#7ed4df]'
      : 'text-ink/55 hover:text-olive dark:text-champagne/70 dark:hover:text-gold',
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
              'relative z-10 w-full max-w-[22.5rem] overflow-hidden rounded-[1.5rem] border p-6 shadow-2xl sm:p-7',
              isAqua
                ? 'aqua-glass border-white/20'
                : 'border-black/8 bg-cream dark:border-white/10 dark:bg-ink-elevated',
            )}
            style={isAqua ? { fontFamily: 'var(--font-aqua-sans)' } : undefined}
          >
            <button
              type="button"
              onClick={onClose}
              className={cn(
                'absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full transition',
                isAqua
                  ? 'text-[#e8f7f9]/55 hover:bg-white/10 hover:text-[#e8f7f9]'
                  : 'text-ink/40 hover:bg-black/5 hover:text-ink dark:text-cream/50 dark:hover:bg-white/10 dark:hover:text-cream',
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
                      n <= signupStep
                        ? isAqua
                          ? 'bg-[#7ed4df]'
                          : 'bg-olive dark:bg-gold'
                        : isAqua
                          ? 'bg-white/20'
                          : 'bg-black/12 dark:bg-white/15',
                    )}
                  />
                ))}
              </div>
            )}

            <div className="text-center">
              <h2
                className={cn(
                  'text-xl tracking-tight sm:text-[1.35rem]',
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
              <p
                className={cn(
                  'mt-1.5 text-xs leading-relaxed',
                  isAqua ? 'text-[#b8e4ea]/75' : 'text-ink/50 dark:text-champagne/65',
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

                <Hint text={hint} isAqua={isAqua} />
                <PrimaryButton isAqua={isAqua} label={busy ? '…' : 'Se connecter'} disabled={busy} />
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
                    <div className="grid grid-cols-2 gap-2.5">
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
                    </div>
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
                    <PrimaryButton
                      isAqua={isAqua}
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
                                ? isAqua
                                  ? 'text-[#8ee0a8]'
                                  : 'font-medium text-emerald-600 dark:text-emerald-400'
                                : isAqua
                                  ? 'text-[#b8e4ea]/55'
                                  : 'text-ink/45 dark:text-champagne/55',
                            )}
                          >
                            <span
                              className={cn(
                                'flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors',
                                ok
                                  ? 'bg-emerald-500 text-white'
                                  : isAqua
                                    ? 'bg-white/10'
                                    : 'bg-black/[0.06] dark:bg-white/10',
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
                        isAqua ? 'text-[#b8e4ea]/70' : 'text-ink/60 dark:text-champagne/70',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={acceptCgu}
                        onChange={(e) => setAcceptCgu(e.target.checked)}
                        className={cn(
                          'mt-0.5 h-3.5 w-3.5 shrink-0 rounded border accent-emerald-500',
                          isAqua ? 'border-white/30' : 'border-black/20 dark:border-white/25',
                        )}
                        disabled={busy}
                      />
                      <span>J&apos;accepte les CGU et la politique de confidentialité</span>
                    </label>

                    <Hint text={hint} isAqua={isAqua} />
                    <PrimaryButton
                      isAqua={isAqua}
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

function PrimaryButton({
  isAqua,
  label,
  disabled,
  icon,
}: {
  isAqua: boolean
  label: string
  disabled?: boolean
  icon?: React.ReactNode
}) {
  if (isAqua) {
    return (
      <button
        type="submit"
        disabled={disabled}
        className="aqua-cta mt-2 w-full !py-3 text-sm disabled:opacity-60"
      >
        <span className="inline-flex items-center justify-center gap-2">
          {label}
          {icon}
        </span>
      </button>
    )
  }

  return (
    <button
      type="submit"
      disabled={disabled}
      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-olive px-4 py-3 text-sm font-semibold text-cream shadow-[0_8px_20px_-8px_rgba(95,107,69,0.55)] transition hover:bg-olive/90 disabled:opacity-60 dark:bg-gold dark:text-ink dark:shadow-[0_8px_20px_-8px_rgba(212,175,55,0.4)] dark:hover:bg-gold-bright"
    >
      {label}
      {icon}
    </button>
  )
}
