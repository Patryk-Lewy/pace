// AUTO-GENERATED from Supabase — do not edit the Database type manually
// Run: supabase gen types typescript --project-id nddvxrcqpqnxtdwiucgz

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          ai_analyzed_at: string | null
          ai_comment: string | null
          avg_heartrate: number | null
          avg_pace_s_per_km: number | null
          created_at: string
          distance_m: number | null
          elapsed_time_s: number | null
          id: string
          matched_workout_id: string | null
          max_heartrate: number | null
          moving_time_s: number | null
          name: string
          start_date: string
          strava_id: number
          strava_type: string
          total_elevation: number | null
          user_id: string
        }
        Insert: {
          ai_analyzed_at?: string | null
          ai_comment?: string | null
          avg_heartrate?: number | null
          avg_pace_s_per_km?: number | null
          created_at?: string
          distance_m?: number | null
          elapsed_time_s?: number | null
          id?: string
          matched_workout_id?: string | null
          max_heartrate?: number | null
          moving_time_s?: number | null
          name: string
          start_date: string
          strava_id: number
          strava_type: string
          total_elevation?: number | null
          user_id: string
        }
        Update: {
          ai_analyzed_at?: string | null
          ai_comment?: string | null
          avg_heartrate?: number | null
          avg_pace_s_per_km?: number | null
          created_at?: string
          distance_m?: number | null
          elapsed_time_s?: number | null
          id?: string
          matched_workout_id?: string | null
          max_heartrate?: number | null
          moving_time_s?: number | null
          name?: string
          start_date?: string
          strava_id?: number
          strava_type?: string
          total_elevation?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_matched_workout_id_fkey"
            columns: ["matched_workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_comments: {
        Row: {
          comment_type: string
          content: string
          created_at: string
          id: string
          plan_id: string | null
          user_id: string
          workout_id: string | null
        }
        Insert: {
          comment_type?: string
          content: string
          created_at?: string
          id?: string
          plan_id?: string | null
          user_id: string
          workout_id?: string | null
        }
        Update: {
          comment_type?: string
          content?: string
          created_at?: string
          id?: string
          plan_id?: string | null
          user_id?: string
          workout_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_comments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_comments_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_goals: {
        Row: {
          created_at: string
          distance: string
          id: string
          is_active: boolean
          target_date: string
          target_time: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          distance: string
          id?: string
          is_active?: boolean
          target_date: string
          target_time?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          distance?: string
          id?: string
          is_active?: boolean
          target_date?: string
          target_time?: string | null
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string | null
          endpoint: string
          id: string
          subscription: Json
          user_id: string
        }
        Insert: {
          created_at?: string | null
          endpoint: string
          id?: string
          subscription: Json
          user_id: string
        }
        Update: {
          created_at?: string | null
          endpoint?: string
          id?: string
          subscription?: Json
          user_id?: string
        }
        Relationships: []
      }
      runner_profiles: {
        Row: {
          additional_goal: string | null
          available_days: string[] | null
          best_5k_pace: string | null
          created_at: string
          id: string
          injury_history: string | null
          max_session_minutes: number | null
          onboarding_completed: boolean
          onboarding_step: number
          pb_10k: string | null
          pb_5k: string | null
          pb_half: string | null
          pb_marathon: string | null
          race_date: string | null
          race_distance: string | null
          race_goal: string | null
          race_goal_time: string | null
          updated_at: string
          weekly_km: number | null
        }
        Insert: {
          additional_goal?: string | null
          available_days?: string[] | null
          best_5k_pace?: string | null
          created_at?: string
          id: string
          injury_history?: string | null
          max_session_minutes?: number | null
          onboarding_completed?: boolean
          onboarding_step?: number
          pb_10k?: string | null
          pb_5k?: string | null
          pb_half?: string | null
          pb_marathon?: string | null
          race_date?: string | null
          race_distance?: string | null
          race_goal?: string | null
          race_goal_time?: string | null
          updated_at?: string
          weekly_km?: number | null
        }
        Update: {
          additional_goal?: string | null
          available_days?: string[] | null
          best_5k_pace?: string | null
          created_at?: string
          id?: string
          injury_history?: string | null
          max_session_minutes?: number | null
          onboarding_completed?: boolean
          onboarding_step?: number
          pb_10k?: string | null
          pb_5k?: string | null
          pb_half?: string | null
          pb_marathon?: string | null
          race_date?: string | null
          race_distance?: string | null
          race_goal?: string | null
          race_goal_time?: string | null
          updated_at?: string
          weekly_km?: number | null
        }
        Relationships: []
      }
      strava_tokens: {
        Row: {
          access_token: string
          athlete_name: string | null
          athlete_photo: string | null
          created_at: string
          expires_at: number
          refresh_token: string
          strava_athlete_id: number
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          athlete_name?: string | null
          athlete_photo?: string | null
          created_at?: string
          expires_at: number
          refresh_token: string
          strava_athlete_id: number
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          athlete_name?: string | null
          athlete_photo?: string | null
          created_at?: string
          expires_at?: number
          refresh_token?: string
          strava_athlete_id?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      training_plans: {
        Row: {
          created_at: string
          id: string
          plan_json: Json
          plan_name: string
          race_date: string | null
          race_distance: string
          status: string
          total_weeks: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan_json: Json
          plan_name: string
          race_date?: string | null
          race_distance: string
          status?: string
          total_weeks: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          plan_json?: Json
          plan_name?: string
          race_date?: string | null
          race_distance?: string
          status?: string
          total_weeks?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      workouts: {
        Row: {
          completed_at: string | null
          created_at: string
          day_of_week: string
          description: string | null
          distance_km: number | null
          duration_minutes: number | null
          id: string
          phase: string | null
          plan_id: string
          scheduled_date: string | null
          status: string
          target_pace: string | null
          title: string
          user_id: string
          user_notes: string | null
          week_number: number
          workout_type: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          day_of_week: string
          description?: string | null
          distance_km?: number | null
          duration_minutes?: number | null
          id?: string
          phase?: string | null
          plan_id: string
          scheduled_date?: string | null
          status?: string
          target_pace?: string | null
          title: string
          user_id: string
          user_notes?: string | null
          week_number: number
          workout_type: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          day_of_week?: string
          description?: string | null
          distance_km?: number | null
          duration_minutes?: number | null
          id?: string
          phase?: string | null
          plan_id?: string
          scheduled_date?: string | null
          status?: string
          target_pace?: string | null
          title?: string
          user_id?: string
          user_notes?: string | null
          week_number?: number
          workout_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "workouts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "training_plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

// ─── Convenience aliases ──────────────────────────────────────────────────────

export type RunnerProfile      = Database['public']['Tables']['runner_profiles']['Row']
export type PlanGoal           = Database['public']['Tables']['plan_goals']['Row']
export type TrainingPlan       = Database['public']['Tables']['training_plans']['Row']
export type Workout            = Database['public']['Tables']['workouts']['Row']
export type AiComment          = Database['public']['Tables']['ai_comments']['Row']
export type StravaToken        = Database['public']['Tables']['strava_tokens']['Row']
export type Activity           = Database['public']['Tables']['activities']['Row']
export type PushSubscriptionRow = Database['public']['Tables']['push_subscriptions']['Row']

// ─── Plan JSON structure returned by Claude ───────────────────────────────────

export type PlanWorkout = {
  day: string
  workout_type: string
  title: string
  distance_km: number | null
  target_pace: string | null
  duration_minutes: number | null
  description: string
}

export type PlanWeek = {
  week_number: number
  phase: string
  focus: string
  total_km: number
  workouts: PlanWorkout[]
}

export type PlanJson = {
  plan_name: string
  total_weeks: number
  weeks: PlanWeek[]
}
