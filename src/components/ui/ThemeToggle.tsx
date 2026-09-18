import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-300',
        'border-black/15 bg-cream-card text-ink/80 shadow-sm',
        'hover:border-olive/40 hover:text-olive hover:shadow',
        'dark:border-champagne/20 dark:bg-ink-elevated dark:text-champagne/80',
        'dark:hover:border-gold/40 dark:hover:text-gold',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/40',
        className,
      )}
    >
      {isDark ? (
        <Moon size={14} strokeWidth={1.85} />
      ) : (
        <Sun size={14} strokeWidth={1.85} />
      )}
    </button>
  )
}
