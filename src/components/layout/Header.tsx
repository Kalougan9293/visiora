import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { User } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { AuthModal } from '@/components/auth/AuthModal'
import { useAuth } from '@/context/AuthContext'
import { APP_COPY } from '@/data/uiCopy'
import { cn } from '@/lib/utils'

export function Header() {
  const { user, profile, loading, signOut } = useAuth()
  const [authOpen, setAuthOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const metaName =
    typeof user?.user_metadata?.first_name === 'string' ? user.user_metadata.first_name.trim() : ''
  const firstName = profile?.first_name?.trim() || metaName
  const loggedIn = Boolean(user)
  const shownNameRef = useRef(firstName)
  if (firstName) shownNameRef.current = firstName
  const shownName = firstName || (loggedIn ? shownNameRef.current : '')

  useEffect(() => {
    setMenuOpen(false)
  }, [user?.id])

  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  async function onSignOut() {
    setMenuOpen(false)
    await signOut()
  }

  return (
    <>
      <header className="sticky top-0 z-40">
        <div className="relative border-b border-[color-mix(in_srgb,var(--vs-ardoise)_22%,transparent)] bg-[color-mix(in_srgb,var(--vs-lunaire)_82%,transparent)] backdrop-blur-xl dark:border-[var(--vs-ardoise)] dark:bg-[var(--vs-nuit)]/90">
          <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center px-3">
            <div className="flex h-8 items-center justify-self-start">
              <ThemeToggle />
            </div>

            <Link to="/" className="flex h-8 items-center">
              <span className="vs-logotype !text-2xl leading-none">VISIORA</span>
            </Link>

            <div className="relative flex h-8 items-center justify-self-end" ref={menuRef}>
                {loggedIn ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setMenuOpen((o) => !o)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-full border border-black/15 px-2.5 text-xs font-medium text-ink/85 transition-all hover:border-[var(--vs-azur)]/50 hover:text-[var(--vs-azur)] dark:border-[var(--vs-ardoise)] dark:text-[var(--vs-lunaire)] dark:hover:border-[var(--vs-azur)] dark:hover:text-[var(--vs-azur)]"
                    >
                      <User size={13} strokeWidth={1.75} />
                      {shownName || null}
                    </button>

                    {menuOpen && (
                      <div className="absolute right-0 top-[calc(100%+0.4rem)] z-50 min-w-[7.5rem] rounded-xl border border-[var(--vs-bordure)] bg-[var(--vs-surface)] px-1 py-1">
                        <button
                          type="button"
                          onClick={() => void onSignOut()}
                          className="w-full rounded-lg px-3 py-2 text-center text-[11px] tracking-wide text-ink/68 transition hover:bg-black/[0.04] hover:text-ink dark:text-[var(--vs-texte-faible)] dark:hover:bg-white/5 dark:hover:text-[var(--vs-ecume)]"
                        >
                          Déconnexion
                        </button>
                      </div>
                    )}
                  </>
                ) : loading ? (
                  <span
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 text-ink/40 dark:border-[var(--vs-ardoise)] dark:text-[var(--vs-texte-faible)]"
                    aria-hidden
                  >
                    <User size={13} strokeWidth={1.75} />
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAuthOpen(true)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-black/15 px-2.5 text-xs font-medium text-ink/85 transition-all hover:border-[var(--vs-azur)]/50 hover:text-[var(--vs-azur)] dark:border-[var(--vs-ardoise)] dark:text-[var(--vs-lunaire)] dark:hover:border-[var(--vs-azur)] dark:hover:text-[var(--vs-azur)]"
                  >
                    <User size={13} strokeWidth={1.75} />
                    Connexion
                  </button>
                )}
            </div>
          </div>
          <p className="pb-1.5 text-center text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--vs-azur)]">
            {APP_COPY.trialBanner}
          </p>
        </div>
      </header>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  )
}
