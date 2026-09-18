import { BookOpen, Home, PlusCircle, TrendingUp } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useVariant } from '@/context/VariantContext'

const tabs = [
  { to: '/', label: 'Accueil', icon: Home, end: true },
  { to: '/creer', label: 'Créer', icon: PlusCircle },
  { to: '/bibliotheque', label: 'Bibliothèque', icon: BookOpen },
  { to: '/suivi', label: 'Suivi', icon: TrendingUp },
]

export function BottomNav() {
  const { isAqua } = useVariant()

  return (
    <nav
      className={cn(
        'fixed bottom-0 left-1/2 z-50 w-full -translate-x-1/2 border-t backdrop-blur-xl',
        isAqua
          ? 'max-w-none border-white/15 bg-[#0d3d47]/95'
          : 'max-w-md border-black/5 bg-cream/90 dark:border-white/5 dark:bg-ink/90 md:max-w-3xl',
      )}
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
                isAqua
                  ? isActive
                    ? 'bg-white/15 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.2)]'
                    : 'text-[#e8f7f9]/55 hover:text-white hover:bg-white/5'
                  : isActive
                    ? 'bg-olive/15 text-olive dark:bg-gold/20 dark:text-gold-bright'
                    : 'text-ink/45 hover:text-ink/70 hover:bg-black/[0.03] dark:text-cream/45 dark:hover:text-cream/75 dark:hover:bg-white/5',
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span
                    className={cn(
                      'absolute inset-x-5 top-0 h-0.5 rounded-full',
                      isAqua ? 'bg-[#7ed4df]' : 'bg-olive dark:bg-gold',
                    )}
                  />
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
