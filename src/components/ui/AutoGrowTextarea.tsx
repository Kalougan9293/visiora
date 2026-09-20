import { useEffect, useRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type AutoGrowTextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'rows' | 'onChange'
> & {
  value: string
  onChange: (value: string) => void
  /** Hauteur de départ (lignes approx.) */
  minRows?: number
  maxRows?: number
}

/** Textarea compacte qui grandit avec le contenu. */
export function AutoGrowTextarea({
  value,
  onChange,
  minRows = 2,
  maxRows = 14,
  className,
  ...rest
}: AutoGrowTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = '0px'
    const styles = getComputedStyle(el)
    const line = Number.parseFloat(styles.lineHeight) || 24
    const padY =
      (Number.parseFloat(styles.paddingTop) || 0) +
      (Number.parseFloat(styles.paddingBottom) || 0)
    const minH = line * minRows + padY
    const maxH = line * maxRows + padY
    const next = Math.min(Math.max(el.scrollHeight, minH), maxH)
    el.style.height = `${next}px`
    el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden'
  }, [value, minRows, maxRows])

  return (
    <textarea
      {...rest}
      ref={ref}
      value={value}
      rows={minRows}
      onChange={(e) => onChange(e.target.value)}
      className={cn('resize-none overflow-hidden', className)}
    />
  )
}
