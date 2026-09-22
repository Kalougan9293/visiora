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
          is_admin: boolean
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
          is_admin?: boolean
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
          is_admin?: boolean
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
          script: string | null
          audio_job: Json | null
          health_ack_at: string | null
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
          script?: string | null
          audio_job?: Json | null
          health_ack_at?: string | null
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
          script?: string | null
          audio_job?: Json | null
          health_ack_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      listens: {
        Row: {
          id: string
          user_id: string
          session_id: string
          listened_on: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          session_id: string
          listened_on?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          session_id?: string
          listened_on?: string
          created_at?: string
        }
        Relationships: []
      }
      health_keywords: {
        Row: {
          id: string
          word: string
          created_at: string
        }
        Insert: {
          id?: string
          word: string
          created_at?: string
        }
        Update: {
          id?: string
          word?: string
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      is_current_user_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
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
      record_listen: {
        Args: { p_session_id: string }
        Returns: boolean
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

/** Table optionnelle — voir supabase/health_keywords.sql */
export type HealthKeywordRow = {
  id: string
  word: string
  created_at: string
}

export type ProfileRow = Database['public']['Tables']['profiles']['Row']
export type SessionRow = Database['public']['Tables']['sessions']['Row']
