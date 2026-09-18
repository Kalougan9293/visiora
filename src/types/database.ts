export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type SessionStatusDb = 'draft' | 'generating' | 'ready' | 'failed'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          first_name: string
          last_name: string
          email: string
          cgu_accepted: boolean
          cgu_accepted_at: string | null
          created_at: string
          updated_at: string
          last_seen_at: string | null
        }
        Insert: {
          id: string
          first_name?: string
          last_name?: string
          email?: string
          cgu_accepted?: boolean
          cgu_accepted_at?: string | null
          created_at?: string
          updated_at?: string
          last_seen_at?: string | null
        }
        Update: {
          id?: string
          first_name?: string
          last_name?: string
          email?: string
          cgu_accepted?: boolean
          cgu_accepted_at?: string | null
          created_at?: string
          updated_at?: string
          last_seen_at?: string | null
        }
        Relationships: []
      }
      sessions: {
        Row: {
          id: string
          user_id: string
          title: string
          answers: Json
          status: SessionStatusDb
          duration_minutes: number
          listens: number
          audio_path: string | null
          audio_url: string | null
          audio_bytes: number | null
          voice_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title?: string
          answers?: Json
          status?: SessionStatusDb
          duration_minutes?: number
          listens?: number
          audio_path?: string | null
          audio_url?: string | null
          audio_bytes?: number | null
          voice_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          answers?: Json
          status?: SessionStatusDb
          duration_minutes?: number
          listens?: number
          audio_path?: string | null
          audio_url?: string | null
          audio_bytes?: number | null
          voice_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      admin_list_users: {
        Args: Record<string, never>
        Returns: {
          id: string
          first_name: string
          last_name: string
          email: string
          audio_count: number
          last_seen_at: string | null
        }[]
      }
      admin_dashboard_stats: {
        Args: Record<string, never>
        Returns: Json
      }
      admin_delete_user: {
        Args: { target_id: string }
        Returns: boolean
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type ProfileRow = Database['public']['Tables']['profiles']['Row']
export type SessionRow = Database['public']['Tables']['sessions']['Row']
