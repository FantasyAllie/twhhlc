export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_users: {
        Row: {
          created_at: string
          id: string
          password_hash: string
          role: string
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          id?: string
          password_hash: string
          role?: string
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          id?: string
          password_hash?: string
          role?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      export_snapshots: {
        Row: {
          created_at: string
          grand_total: number
          id: string
          kind: string
          totals: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          grand_total?: number
          id?: string
          kind?: string
          totals: Json
          user_id?: string
        }
        Update: {
          created_at?: string
          grand_total?: number
          id?: string
          kind?: string
          totals?: Json
          user_id?: string
        }
        Relationships: []
      }
      reception_items: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          label: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reject_counts: {
        Row: {
          count: number
          id: string
          template_item_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          count?: number
          id?: string
          template_item_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          count?: number
          id?: string
          template_item_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      room_extra_items: {
        Row: {
          created_at: string
          id: string
          name: string
          room_number: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          room_number: number
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          room_number?: number
          user_id?: string
        }
        Relationships: []
      }
      room_feature_rooms: {
        Row: {
          created_at: string
          feature_id: string
          id: string
          room_number: number
          user_id: string
        }
        Insert: {
          created_at?: string
          feature_id: string
          id?: string
          room_number: number
          user_id?: string
        }
        Update: {
          created_at?: string
          feature_id?: string
          id?: string
          room_number?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_feature_rooms_feature_id_fkey"
            columns: ["feature_id"]
            isOneToOne: false
            referencedRelation: "room_features"
            referencedColumns: ["id"]
          },
        ]
      }
      room_features: {
        Row: {
          created_at: string
          id: string
          label: string
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          updated_at?: string
          user_id?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: []
      }
      room_item_counts: {
        Row: {
          count: number
          id: string
          item_id: string
          item_kind: string
          room_number: number
          updated_at: string
          user_id: string
        }
        Insert: {
          count?: number
          id?: string
          item_id: string
          item_kind: string
          room_number: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          count?: number
          id?: string
          item_id?: string
          item_kind?: string
          room_number?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      room_messages: {
        Row: {
          created_at: string
          created_by_username: string | null
          dismissed: boolean
          id: string
          message: string
          room_number: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by_username?: string | null
          dismissed?: boolean
          id?: string
          message: string
          room_number: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          created_by_username?: string | null
          dismissed?: boolean
          id?: string
          message?: string
          room_number?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      room_types: {
        Row: {
          created_at: string
          id: string
          label: string
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          updated_at?: string
          user_id?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: []
      }
      rooms: {
        Row: {
          category: string | null
          default_status: string | null
          done: boolean
          done_reception: boolean
          guest_vacated: boolean
          housekeeping_note: string | null
          id: string
          needs_maintenance: boolean
          reception_bed_id: string | null
          reception_status_id: string | null
          room_number: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          default_status?: string | null
          done?: boolean
          done_reception?: boolean
          guest_vacated?: boolean
          housekeeping_note?: string | null
          id?: string
          needs_maintenance?: boolean
          reception_bed_id?: string | null
          reception_status_id?: string | null
          room_number: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          category?: string | null
          default_status?: string | null
          done?: boolean
          done_reception?: boolean
          guest_vacated?: boolean
          housekeeping_note?: string | null
          id?: string
          needs_maintenance?: boolean
          reception_bed_id?: string | null
          reception_status_id?: string | null
          room_number?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      template_item_rooms: {
        Row: {
          created_at: string
          id: string
          room_number: number
          template_item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          room_number: number
          template_item_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          room_number?: number
          template_item_id?: string
          user_id?: string
        }
        Relationships: []
      }
      template_items: {
        Row: {
          category: string
          color: string | null
          created_at: string
          default_count: number
          id: string
          name: string
          position: number
          user_id: string
        }
        Insert: {
          category?: string
          color?: string | null
          created_at?: string
          default_count?: number
          id?: string
          name: string
          position?: number
          user_id?: string
        }
        Update: {
          category?: string
          color?: string | null
          created_at?: string
          default_count?: number
          id?: string
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: []
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
