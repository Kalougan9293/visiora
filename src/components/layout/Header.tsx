import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { User } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { AuthModal } from '@/components/auth/AuthModal'
import { useAuth } from '@/context/AuthContext'
import { useVariant } from '@/context/VariantContext'
import { cn } from '@/lib/utils'

export function Header() {
  const { isAqua, toggleVariant } = useVariant()
  const { user, profile, signOut } = useAuth()
  const [authOpen, setAuthOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const label = user
    ? profile?.first_name?.trim() || 'Profil'
    : 'Connexion'

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
        <div
          className={cn(
            'relative border-b backdrop-blur-xl',
            isAqua
              ? 'border-white/10 bg-[#0d3d47]/75'
              : 'border-black/8 bg-cream/80 dark:border-white/8 dark:bg-ink/75',
          )}
        >
          <div className="relative flex h-14 items-center justify-center px-4">
            <button
              type="button"
              onClick={toggleVariant}
              className={cn(
                'absolute left-3 top-1/2 -translate-y-1/2 rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] transition-all',
                isAqua
                  ? 'border border-white/25 bg-white/10 text-[#e8f7f9] hover:bg-white/15'
                  : 'border border-black/12 bg-black/[0.03] text-ink/55 hover:border-olive/40 hover:text-olive dark:border-champagne/20 dark:text-champagne/78 dark:hover:text-gold',
              )}
              title={isAqua ? 'Revenir à la version client' : 'Ouvrir la version test'}
            >
              {isAqua ? 'Version client' : 'Version test'}
            </button>

            <Link to="/" className="group flex items-center">
              <span
                className={cn(
                  'text-2xl font-medium tracking-[0.14em] transition-colors',
                  isAqua
                    ? 'text-[#e8f7f9] hover:text-[#7ed4df]'
                    : 'font-display text-ink group-hover:text-olive dark:text-cream dark:group-hover:text-gold',
                )}
                style={isAqua ? { fontFamily: 'var(--font-aqua-display)' } : undefined}
              >
                VISIORA
              </span>
            </Link>

            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="relative flex flex-col items-center" ref={menuRef}>
                {user ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setMenuOpen((o) => !o)}
                      className={cn(
                        'inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-all',
                        isAqua
                          ? 'border-white/20 text-[#e8f7f9]/90 hover:border-[#7ed4df]/50 hover:text-[#7ed4df]'
                          : 'border-black/15 text-ink/85 hover:border-olive/50 hover:text-olive dark:border-champagne/25 dark:text-cream/85 dark:hover:border-gold/40 dark:hover:text-gold',
                      )}
                    >
                      <User size={13} strokeWidth={1.75} />
                      {label}
                    </button>

                    {menuOpen && (
                      <div
                        className={cn(
                          'absolute right-0 top-[calc(100%+0.4rem)] z-50 min-w-[7.5rem] rounded-xl border px-1 py-1 shadow-lg backdrop-blur-xl',
                          isAqua
                            ? 'border-white/15 bg-[#0d3d47]/95'
                            : 'border-black/10 bg-cream/95 dark:border-white/12 dark:bg-ink-elevated/95',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => void onSignOut()}
                          className={cn(
                            'w-full rounded-lg px-3 py-2 text-center text-[11px] tracking-wide transition',
                            isAqua
                              ? 'text-[#b8e4ea]/70 hover:bg-white/10 hover:text-[#e8f7f9]'
                              : 'text-ink/55 hover:bg-black/[0.04] hover:text-ink dark:text-champagne/65 dark:hover:bg-white/8 dark:hover:text-cream',
                          )}
                        >
                          Déconnexion
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAuthOpen(true)}
                    className={cn(
                      'inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-all',
                      isAqua
                        ? 'border-white/20 text-[#e8f7f9]/90 hover:border-[#7ed4df]/50 hover:text-[#7ed4df]'
                        : 'border-black/15 text-ink/85 hover:border-olive/50 hover:text-olive dark:border-champagne/25 dark:text-cream/85 dark:hover:border-gold/40 dark:hover:text-gold',
                    )}
                  >
                    <User size={13} strokeWidth={1.75} />
                    Connexion
                  </button>
                )}

                {!isAqua && (
                  <div className="absolute left-1/2 top-[calc(100%+1.35rem)] z-10 -translate-x-1/2">
                    <ThemeToggle />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  )
}
