import { cn } from '@/lib/utils'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'outline' | 'soft'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition-all duration-300 ease-[var(--ease-out-expo)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vs-ecume)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--vs-nuit)]',
        'disabled:pointer-events-none disabled:opacity-40',
        size === 'sm' && 'px-3.5 py-2 text-sm',
        size === 'md' && 'px-5 py-3 text-sm',
        size === 'lg' && 'px-6 py-3.5 text-base',
        variant === 'primary' &&
          'bg-[var(--vs-or)] text-[var(--vs-nuit)] hover:brightness-105 dark:bg-[var(--vs-or)] dark:text-[var(--vs-nuit)] dark:hover:brightness-110',
        variant === 'ghost' && 'bg-transparent text-current hover:bg-black/5 dark:hover:bg-white/5',
        variant === 'outline' &&
          'border border-black/10 bg-transparent text-ink hover:border-[var(--vs-azur)]/50 dark:border-[var(--vs-ardoise)] dark:text-[var(--vs-lunaire)] dark:hover:border-[var(--vs-azur)]',
        variant === 'soft' && 'glass',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
