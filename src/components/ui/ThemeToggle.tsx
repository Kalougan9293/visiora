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
        'flex h-8 w-8 items-center justify-center rounded-full border shadow-sm transition-all duration-300',
        'border-[#5f6b45]/40 bg-[#faf7f2] text-[#5f6b45]',
        'hover:border-[#5f6b45] hover:bg-[#5f6b45]/10',
        'dark:border-[#5f6b45]/55 dark:bg-[#0b1e44] dark:text-[#5f6b45]',
        'dark:hover:border-[#9aab82] dark:hover:text-[#9aab82]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5f6b45]/40',
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
