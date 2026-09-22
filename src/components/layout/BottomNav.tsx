import { BookOpen, Home, PlusCircle, TrendingUp } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

const tabs = [
  { to: '/', label: 'Accueil', icon: Home, end: true },
  { to: '/creer', label: 'Créer', icon: PlusCircle },
  { to: '/bibliotheque', label: 'Bibliothèque', icon: BookOpen },
  { to: '/suivi', label: 'Suivi', icon: TrendingUp },
]

export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-1/2 z-50 w-full max-w-[35rem] -translate-x-1/2 border-t border-[var(--vs-bordure)] bg-[var(--vs-surface)] dark:bg-[var(--vs-nuit)]/95"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch justify-around px-1.5 py-1">
        {tabs.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 text-[10px] font-semibold tracking-wide transition-all duration-200',
                isActive
                  ? 'bg-[var(--vs-azur)]/15 text-[var(--vs-azur)] dark:bg-[var(--vs-abysse)] dark:text-[var(--vs-ecume)]'
                  : 'text-ink/55 hover:bg-black/[0.03] hover:text-ink/80 dark:text-[var(--vs-texte-faible)] dark:hover:bg-white/5 dark:hover:text-[var(--vs-ecume)]',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-[var(--vs-azur)]" />
                )}
                <Icon size={22} strokeWidth={isActive ? 2.4 : 1.75} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
