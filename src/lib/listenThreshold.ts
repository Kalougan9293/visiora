/** Un jour n’est validé dans le Suivi qu’après ~80 % du MP3. */
export const LISTEN_COMPLETE_RATIO = 0.8

export function hasListenedEnough(currentTime: number, duration: number, ended = false): boolean {
  if (ended) return true
  if (!duration || !Number.isFinite(duration) || duration <= 0) return false
  if (!Number.isFinite(currentTime) || currentTime < 0) return false
  return currentTime / duration >= LISTEN_COMPLETE_RATIO
}
