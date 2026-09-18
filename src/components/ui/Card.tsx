import { cn } from '@/lib/utils'
import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  interactive?: boolean
  selected?: boolean
}

export function Card({
  children,
  className,
  interactive,
  selected,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'glass rounded-2xl p-4 transition-all duration-300 ease-[var(--ease-out-expo)]',
        interactive &&
          'cursor-pointer hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(0,0,0,0.18)] dark:hover:shadow-[0_16px_40px_rgba(0,0,0,0.45)] hover:border-gold/35',
        selected && 'glow-gold border-gold/45 bg-gold/10 dark:bg-gold/10',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
