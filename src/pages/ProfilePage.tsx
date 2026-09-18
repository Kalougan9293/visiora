import { User } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useTheme } from '@/context/ThemeContext'
import { useSessions } from '@/context/SessionsContext'
import { useAuth } from '@/context/AuthContext'
import { useVariant } from '@/context/VariantContext'
import { cn } from '@/lib/utils'

export function ProfilePage() {
  const { theme } = useTheme()
  const { sessions, stats } = useSessions()
  const { user, profile, signOut, configured } = useAuth()
  const { isAqua } = useVariant()

  const display =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') ||
    user?.email ||
    'Profil'

  return (
    <div className="flex w-full flex-col items-center space-y-6 pb-4">
      <div className="flex flex-col items-center gap-3">
        <div
          className={cn(
            'flex h-16 w-16 items-center justify-center rounded-full',
            isAqua ? 'bg-white/10 text-[#7ed4df]' : 'bg-gold/20 text-gold',
          )}
        >
          <User size={28} strokeWidth={1.5} />
        </div>
        <div>
          <h1
            className={cn(
              'text-3xl tracking-tight',
              isAqua ? 'text-[#f4fcfd]' : 'font-display',
            )}
            style={isAqua ? { fontFamily: 'var(--font-aqua-display)', fontWeight: 450 } : undefined}
          >
            {display}
          </h1>
          <p
            className={cn(
              'mt-1 text-sm',
              isAqua ? 'text-[#b8e4ea]/70' : 'text-ink/70 dark:text-champagne/78',
            )}
          >
            {user
              ? profile?.email || user.email
              : configured
                ? 'Non connecté'
                : 'Compte local — configure Supabase'}
          </p>
        </div>
      </div>

      <Card className="w-full !p-4 space-y-4">
        {!isAqua && (
          <>
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm">Thème</span>
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs text-ink/65 dark:text-champagne/75">
                  {theme === 'dark' ? 'Sombre' : 'Clair'}
                </span>
                <ThemeToggle />
              </div>
            </div>
            <div className="h-px bg-black/5 dark:bg-white/5" />
          </>
        )}
        <Row label="Séances créées" value={String(sessions.length)} isAqua={isAqua} />
        <Row label="Série actuelle" value={`${stats.streakDays} j`} isAqua={isAqua} />
        <Row label="Écoutes" value={String(stats.totalListens)} isAqua={isAqua} />
        {profile?.cgu_accepted && (
          <Row label="CGU" value="Acceptées" isAqua={isAqua} />
        )}
      </Card>

      {user && (
        <button
          type="button"
          onClick={() => void signOut()}
          className={cn(
            'text-xs uppercase tracking-[0.14em] transition',
            isAqua
              ? 'text-[#b8e4ea]/55 hover:text-[#7ed4df]'
              : 'text-ink/50 hover:text-olive dark:text-champagne/55 dark:hover:text-gold',
          )}
        >
          Déconnexion
        </button>
      )}
    </div>
  )
}

function Row({
  label,
  value,
  isAqua,
}: {
  label: string
  value: string
  isAqua: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 text-sm">
      <span className={isAqua ? 'text-[#b8e4ea]/70' : 'text-ink/70 dark:text-champagne/82'}>
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
