export type Theme = 'dark' | 'light'

export type NavTab = 'home' | 'create' | 'library' | 'progress'

export interface ChoiceOption {
  id: string
  label: string
  description?: string
}

export interface QuestionStep {
  id: string
  number: number
  title: string
  subtitle?: string
  type: 'single' | 'multi' | 'text'
  options?: ChoiceOption[]
  placeholder?: string
  maxSelections?: number
}

export interface VisualizationAnswers {
  [questionId: string]: string | string[]
}

export type SessionStatus = 'draft' | 'generating' | 'ready' | 'failed'

/** Ready for Supabase row + ElevenLabs audio URL */
export interface VisualizationSession {
  id: string
  userId?: string
  title: string
  createdAt: string
  updatedAt: string
  durationMinutes: number
  answers: VisualizationAnswers
  status: SessionStatus
  /** Pre-generated audio URL (Supabase Storage / CDN) — never live TTS */
  audioUrl?: string | null
  audioStoragePath?: string | null
  /** Script Annexe / généré — restitution lisible */
  script?: string | null
  /** 0–100 pendant `generating` (stocké temporairement dans audio_bytes) */
  audioProgress?: number
  listens: number
  tags?: string[]
}

/** Une journée validée pour une visualisation (table `listens`). */
export interface ListenMark {
  sessionId: string
  date: string
}

export interface DayLogEntry {
  date: string // YYYY-MM-DD
  completed: boolean
  listenCount: number
}

export interface ProgressStats {
  streakDays: number
  totalListens: number
  milestoneTarget: number
  daysCompletedTowardMilestone: number
  journal: DayLogEntry[]
}
