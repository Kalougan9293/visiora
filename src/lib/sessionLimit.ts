/** Trois séances gardées. La suivante efface les plus anciennes. */

export const SESSION_KEEP = 3

export function sessionsEvictedByNewOne<T extends { createdAt: string }>(sessions: T[]): T[] {
  if (sessions.length < SESSION_KEEP) return []
  const oldestFirst = [...sessions].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  return oldestFirst.slice(0, sessions.length - (SESSION_KEEP - 1))
}
