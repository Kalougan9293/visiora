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
        'inline-flex h-8 w-8 items-center justify-center rounded-full border transition-all duration-300',
        'border-[color-mix(in_srgb,var(--vs-ardoise)_28%,transparent)] bg-[var(--vs-surface)] text-[var(--vs-azur)]',
        'hover:border-[var(--vs-azur)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vs-azur)]/40',
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
