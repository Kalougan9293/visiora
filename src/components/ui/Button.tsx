import { cn } from '@/lib/utils'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { useVariant } from '@/context/VariantContext'

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
  const { isAqua } = useVariant()

  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-2xl font-medium transition-all duration-300 ease-[var(--ease-out-expo)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-40',
        size === 'sm' && 'px-3.5 py-2 text-sm',
        size === 'md' && 'px-5 py-3 text-sm',
        size === 'lg' && 'px-6 py-3.5 text-base',
        isAqua
          ? cn(
              'focus-visible:ring-gold/50 dark:focus-visible:ring-offset-ink focus-visible:ring-offset-cream',
              variant === 'primary' &&
                'bg-olive text-cream shadow-[0_0_0_1px_rgba(95,107,69,0.25)] hover:-translate-y-0.5 hover:bg-[#6d7a50] hover:shadow-[0_12px_36px_rgba(95,107,69,0.28)] active:translate-y-0 dark:bg-gold dark:text-ink dark:shadow-[0_0_0_1px_rgba(212,165,116,0.28)] dark:hover:bg-gold-bright dark:hover:shadow-[0_12px_40px_rgba(212,165,116,0.28)]',
              variant === 'ghost' && 'bg-transparent text-current hover:bg-black/5 dark:hover:bg-white/5',
              variant === 'outline' &&
                'border border-black/10 bg-transparent dark:border-champagne/20 hover:border-gold/50 hover:bg-gold/5',
              variant === 'soft' && 'glass hover:-translate-y-0.5 hover:glow-gold',
            )
          : cn(
              'focus-visible:ring-[var(--vs-ecume)] focus-visible:ring-offset-[var(--vs-nuit)]',
              variant === 'primary' &&
                'bg-olive text-cream hover:bg-[#6d7a50] dark:bg-gold dark:text-ink dark:hover:bg-gold-bright',
              variant === 'ghost' && 'bg-transparent text-current hover:bg-black/5 dark:hover:bg-white/5',
              variant === 'outline' &&
                'border border-black/10 bg-transparent text-ink hover:border-olive/50 dark:border-[var(--vs-ardoise)] dark:text-[var(--vs-lunaire)] dark:hover:border-[var(--vs-azur)]',
              variant === 'soft' && 'glass',
            ),
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
