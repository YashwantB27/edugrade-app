import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      semesters: {
        Row: {
          id: string
          user_id: string
          label: string
          year: number
          semester_number: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          label: string
          year: number
          semester_number: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          label?: string
          year?: number
          semester_number?: number
          created_at?: string
          updated_at?: string
        }
      }
      subjects: {
        Row: {
          id: string
          semester_id: string
          user_id: string
          name: string
          credits: number
          grade: string | null
          grade_points: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          semester_id: string
          user_id: string
          name: string
          credits: number
          grade?: string | null
          grade_points?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          semester_id?: string
          user_id?: string
          name?: string
          credits?: number
          grade?: string | null
          grade_points?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      attendance: {
        Row: {
          id: string
          subject_id: string
          user_id: string
          classes_attended: number
          total_classes: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          subject_id: string
          user_id: string
          classes_attended?: number
          total_classes?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          subject_id?: string
          user_id?: string
          classes_attended?: number
          total_classes?: number
          created_at?: string
          updated_at?: string
        }
      }
      targets: {
        Row: {
          id: string
          user_id: string
          target_cgpa: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          target_cgpa: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          target_cgpa?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
