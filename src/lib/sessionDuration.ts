/** Durées de séance supportées — paramètre, pas une constante. */
export const SESSION_DURATIONS = [15, 10, 3] as const

export type SessionDuration = (typeof SESSION_DURATIONS)[number]

export function normalizeDuration(value: unknown): SessionDuration {
  const n = Number(value)
  if (n === 3 || n === 10 || n === 15) return n
  return 15
}
