export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      action_plans: {
        Row: {
          created_at: string
          ends_at: string
          id: string
          overall_message: string | null
          source_analysis_id: string | null
          start_metrics: Json | null
          started_at: string
          status: string
          steps: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          ends_at?: string
          id?: string
          overall_message?: string | null
          source_analysis_id?: string | null
          start_metrics?: Json | null
          started_at?: string
          status?: string
          steps?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          ends_at?: string
          id?: string
          overall_message?: string | null
          source_analysis_id?: string | null
          start_metrics?: Json | null
          started_at?: string
          status?: string
          steps?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plans_source_analysis_id_fkey"
            columns: ["source_analysis_id"]
            isOneToOne: false
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      analyses: {
        Row: {
          avg_confidence: number | null
          cfpb_responses: Json | null
          created_at: string
          debt_to_income_ratio: number
          debt_total: number
          debts: Json
          emergency_fund_months: number
          emotional_status: Json | null
          id: string
          input_text: string
          insights: Json
          liquid_savings: number | null
          mentioned_spending: Json | null
          monthly_debt_service: number | null
          monthly_expenses: number
          monthly_income: number
          monthly_savings: number
          positive_behaviors: Json | null
          roast: string
          savings_rate: number
          score: number
          score_modifier: number | null
          score_modifier_reason: string | null
          share_captions: Json | null
          spending_breakdown: Json
          summary: string
          top_fix: Json | null
          top_problems: Json | null
          user_id: string | null
        }
        Insert: {
          avg_confidence?: number | null
          cfpb_responses?: Json | null
          created_at?: string
          debt_to_income_ratio: number
          debt_total: number
          debts?: Json
          emergency_fund_months: number
          emotional_status?: Json | null
          id?: string
          input_text: string
          insights?: Json
          liquid_savings?: number | null
          mentioned_spending?: Json | null
          monthly_debt_service?: number | null
          monthly_expenses: number
          monthly_income: number
          monthly_savings: number
          positive_behaviors?: Json | null
          roast: string
          savings_rate: number
          score: number
          score_modifier?: number | null
          score_modifier_reason?: string | null
          share_captions?: Json | null
          spending_breakdown?: Json
          summary: string
          top_fix?: Json | null
          top_problems?: Json | null
          user_id?: string | null
        }
        Update: {
          avg_confidence?: number | null
          cfpb_responses?: Json | null
          created_at?: string
          debt_to_income_ratio?: number
          debt_total?: number
          debts?: Json
          emergency_fund_months?: number
          emotional_status?: Json | null
          id?: string
          input_text?: string
          insights?: Json
          liquid_savings?: number | null
          mentioned_spending?: Json | null
          monthly_debt_service?: number | null
          monthly_expenses?: number
          monthly_income?: number
          monthly_savings?: number
          positive_behaviors?: Json | null
          roast?: string
          savings_rate?: number
          score?: number
          score_modifier?: number | null
          score_modifier_reason?: string | null
          share_captions?: Json | null
          spending_breakdown?: Json
          summary?: string
          top_fix?: Json | null
          top_problems?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analyses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_rate_limits: {
        Row: {
          bucket_key: string
          request_count: number
          window_start: string
        }
        Insert: {
          bucket_key: string
          request_count?: number
          window_start: string
        }
        Update: {
          bucket_key?: string
          request_count?: number
          window_start?: string
        }
        Relationships: []
      }
      check_ins: {
        Row: {
          created_at: string
          id: string
          metrics: Json | null
          mood: number
          notes: string | null
          reflection: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metrics?: Json | null
          mood: number
          notes?: string | null
          reflection?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metrics?: Json | null
          mood?: number
          notes?: string | null
          reflection?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "check_ins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          analysis_id: string | null
          created_at: string
          display_name: string
          id: string
          roast: string
          score: number
          summary: string
          user_id: string
        }
        Insert: {
          analysis_id?: string | null
          created_at?: string
          display_name: string
          id?: string
          roast: string
          score: number
          summary: string
          user_id: string
        }
        Update: {
          analysis_id?: string | null
          created_at?: string
          display_name?: string
          id?: string
          roast?: string
          score?: number
          summary?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: true
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_context: {
        Row: {
          created_at: string
          debt_bracket: string | null
          dob: string | null
          employment_status: string | null
          income_bracket: string | null
          liquid_savings_bracket: string | null
          living_situation: string | null
          state: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          debt_bracket?: string | null
          dob?: string | null
          employment_status?: string | null
          income_bracket?: string | null
          liquid_savings_bracket?: string | null
          living_situation?: string | null
          state?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          debt_bracket?: string | null
          dob?: string | null
          employment_status?: string | null
          income_bracket?: string | null
          liquid_savings_bracket?: string | null
          living_situation?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_context_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_snapshots: {
        Row: {
          debt_to_income: number | null
          debt_total: number | null
          debts: Json
          emergency_fund_months: number | null
          liquid_savings: number | null
          monthly_expenses: number | null
          monthly_income: number | null
          monthly_savings: number | null
          provenance: Json
          savings_rate: number | null
          score: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          debt_to_income?: number | null
          debt_total?: number | null
          debts?: Json
          emergency_fund_months?: number | null
          liquid_savings?: number | null
          monthly_expenses?: number | null
          monthly_income?: number | null
          monthly_savings?: number | null
          provenance?: Json
          savings_rate?: number | null
          score?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          debt_to_income?: number | null
          debt_total?: number | null
          debts?: Json
          emergency_fund_months?: number | null
          liquid_savings?: number | null
          monthly_expenses?: number | null
          monthly_income?: number | null
          monthly_savings?: number | null
          provenance?: Json
          savings_rate?: number | null
          score?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_entitlements: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          plan: string | null
          product_id: string | null
          rc_entitlement: string | null
          status: string | null
          store: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          plan?: string | null
          product_id?: string | null
          rc_entitlement?: string | null
          status?: string | null
          store?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          plan?: string | null
          product_id?: string | null
          rc_entitlement?: string | null
          status?: string | null
          store?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_entitlements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts_with_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          checkin_config: Json | null
          created_at: string
          debt_strategy: string
          first_name: string | null
          id: string
          last_name: string | null
          onboarded: boolean
          preferred_tone: string
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          checkin_config?: Json | null
          created_at?: string
          debt_strategy?: string
          first_name?: string | null
          id: string
          last_name?: string | null
          onboarded?: boolean
          preferred_tone?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          checkin_config?: Json | null
          created_at?: string
          debt_strategy?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          onboarded?: boolean
          preferred_tone?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      tracked_subscriptions: {
        Row: {
          amount: number
          billing_period: string
          category: string | null
          created_at: string
          id: string
          last_used: string | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          billing_period?: string
          category?: string | null
          created_at?: string
          id?: string
          last_used?: string | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          billing_period?: string
          category?: string | null
          created_at?: string
          id?: string
          last_used?: string | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracked_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      community_posts_with_counts: {
        Row: {
          analysis_id: string | null
          created_at: string | null
          display_name: string | null
          id: string | null
          reaction_count: number | null
          roast: string | null
          score: number | null
          summary: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "community_posts_analysis_id_fkey"
            columns: ["analysis_id"]
            isOneToOne: true
            referencedRelation: "analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      check_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      is_username_available: { Args: { p_username: string }; Returns: boolean }
      set_username: { Args: { p_username: string }; Returns: Json }
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

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

