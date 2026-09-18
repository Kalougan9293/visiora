/**
 * ElevenLabs / audio pipeline stubs.
 * Architecture: generate once offline → store in Supabase Storage → stream URL here.
 * Never call live TTS from the client during playback.
 */

export interface AudioSource {
  url: string
  durationSeconds?: number
  mimeType?: string
}

export interface GenerateAudioRequest {
  sessionId: string
  script: string
  voiceId: string
  /** ambient bed track id */
  ambianceId?: string
}

export const audioService = {
  /**
   * Future server endpoint: POST /api/audio/generate
   * Uses ElevenLabs on the backend, uploads result, returns CDN URL.
   */
  async requestGeneration(_payload: GenerateAudioRequest): Promise<AudioSource | null> {
    console.info('[audio] Generation pipeline not connected yet')
    return null
  },

  resolvePlaybackUrl(sessionAudioUrl?: string | null): string | null {
    return sessionAudioUrl ?? null
  },
}
