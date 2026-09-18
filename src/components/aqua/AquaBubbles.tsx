import { useMemo } from 'react'

const BUBBLES_FULL = [
  { left: '8%', size: 14, duration: 14, delay: 0 },
  { left: '18%', size: 22, duration: 18, delay: 2 },
  { left: '28%', size: 10, duration: 12, delay: 5 },
  { left: '42%', size: 28, duration: 20, delay: 1 },
  { left: '55%', size: 12, duration: 15, delay: 7 },
  { left: '68%', size: 18, duration: 16, delay: 3 },
  { left: '78%', size: 34, duration: 22, delay: 4 },
  { left: '88%', size: 11, duration: 13, delay: 6 },
  { left: '12%', size: 16, duration: 19, delay: 9 },
  { left: '35%', size: 9, duration: 11, delay: 8 },
  { left: '62%', size: 24, duration: 17, delay: 2.5 },
  { left: '92%', size: 15, duration: 14, delay: 10 },
]

/** Moins de bulles, un peu plus petites — fond discret. */
const BUBBLES_SOFT = [
  { left: '12%', size: 12, duration: 16, delay: 0 },
  { left: '38%', size: 18, duration: 19, delay: 3 },
  { left: '62%', size: 10, duration: 14, delay: 6 },
  { left: '78%', size: 22, duration: 20, delay: 1.5 },
  { left: '88%', size: 9, duration: 15, delay: 8 },
]

export function AquaBubbles({ density = 'full' }: { density?: 'full' | 'soft' }) {
  const bubbles = useMemo(
    () => (density === 'soft' ? BUBBLES_SOFT : BUBBLES_FULL),
    [density],
  )

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {bubbles.map((b, i) => (
        <span
          key={i}
          className="aqua-bubble"
          style={{
            left: b.left,
            bottom: `-${b.size}px`,
            width: b.size,
            height: b.size,
            animationDuration: `${b.duration}s`,
            animationDelay: `${b.delay}s`,
          }}
        />
      ))}
    </div>
  )
}
