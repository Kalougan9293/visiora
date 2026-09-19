import { isSupabaseConfigured, supabase } from './supabase'

export type ElevenVoicePreview = {
  id: string
  name: string
  previewUrl: string
  category: string
  gender: string
  accent: string
  description: string
  slot: string | null
}

export const voicesLabService = {
  async list(): Promise<ElevenVoicePreview[]> {
    if (!isSupabaseConfigured() || !supabase) {
      throw new Error('Supabase non configuré')
    }
    const { data, error } = await supabase.functions.invoke<{
      voices?: ElevenVoicePreview[]
      error?: string
    }>('list-eleven-voices', { method: 'POST', body: {} })

    if (error) {
      const fromBody = data && typeof data === 'object' ? data.error : undefined
      throw new Error(fromBody || error.message)
    }
    if (data?.error) throw new Error(data.error)
    return data?.voices ?? []
  },
}
