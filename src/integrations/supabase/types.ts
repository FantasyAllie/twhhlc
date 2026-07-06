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
      fnb_linen_counts: {
        Row: {
          count: number
          template_item_id: string
          updated_at: string
        }
        Insert: {
          count?: number
          template_item_id: string
          updated_at?: string
        }
        Update: {
          count?: number
          template_item_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fnb_linen_counts_template_item_id_fkey"
            columns: ["template_item_id"]
            isOneToOne: true
            referencedRelation: "template_items"
            referencedColumns: ["id"]
          },
        ]
      }
      lost_property: {
        Row: {
          created_at: string
          created_by_role: string | null
          created_by_username: string | null
          deleted_at: string | null
          id: string
          message: string
          resolved_at: string | null
          resolved_by_username: string | null
          room_number: number | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by_role?: string | null
          created_by_username?: string | null
          deleted_at?: string | null
          id?: string
          message: string
          resolved_at?: string | null
          resolved_by_username?: string | null
          room_number?: number | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by_role?: string | null
          created_by_username?: string | null
          deleted_at?: string | null
          id?: string
          message?: string
          resolved_at?: string | null
          resolved_by_username?: string | null
          room_number?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      maintenance_requests: {
        Row: {
          created_at: string
          created_by_username: string | null
          deleted_at: string | null
          done: boolean
          done_at: string | null
          done_by_username: string | null
          id: string
          message: string
          origin_department: string | null
          room_number: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by_username?: string | null
          deleted_at?: string | null
          done?: boolean
          done_at?: string | null
          done_by_username?: string | null
          id?: string
          message: string
          origin_department?: string | null
          room_number: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          created_by_username?: string | null
          deleted_at?: string | null
          done?: boolean
          done_at?: string | null
          done_by_username?: string | null
          id?: string
          message?: string
          origin_department?: string | null
          room_number?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          checkout_enabled: boolean
          done_enabled: boolean
          messages_enabled: boolean
          notify_from_fnb: boolean
          notify_from_housekeeping: boolean
          notify_from_reception: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          checkout_enabled?: boolean
          done_enabled?: boolean
          messages_enabled?: boolean
          notify_from_fnb?: boolean
          notify_from_housekeeping?: boolean
          notify_from_reception?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          checkout_enabled?: boolean
          done_enabled?: boolean
          messages_enabled?: boolean
          notify_from_fnb?: boolean
          notify_from_housekeeping?: boolean
          notify_from_reception?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          preferences: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          preferences?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          preferences?: Json
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string
          p256dh?: string
          user_agent?: string | null
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
          sort_order: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          label: string
          sort_order?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string
          sort_order?: number | null
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
          sort_order: number | null
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          sort_order?: number | null
          updated_at?: string
          user_id?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          sort_order?: number | null
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
          deleted_at: string | null
          dismissed: boolean
          done_at: string | null
          id: string
          message: string
          reply_to_id: string | null
          reply_to_sender: string | null
          reply_to_snippet: string | null
          room_number: number | null
          thread: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by_username?: string | null
          deleted_at?: string | null
          dismissed?: boolean
          done_at?: string | null
          id?: string
          message: string
          reply_to_id?: string | null
          reply_to_sender?: string | null
          reply_to_snippet?: string | null
          room_number?: number | null
          thread?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          created_by_username?: string | null
          deleted_at?: string | null
          dismissed?: boolean
          done_at?: string | null
          id?: string
          message?: string
          reply_to_id?: string | null
          reply_to_sender?: string | null
          reply_to_snippet?: string | null
          room_number?: number | null
          thread?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "room_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      room_types: {
        Row: {
          created_at: string
          id: string
          label: string
          sort_order: number | null
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          sort_order?: number | null
          updated_at?: string
          user_id?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          sort_order?: number | null
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
          reception_status_secondary_id: string | null
          room_number: number
          sort_order: number
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
          reception_status_secondary_id?: string | null
          room_number: number
          sort_order?: number
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
          reception_status_secondary_id?: string | null
          room_number?: number
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rooms_reception_status_secondary_id_fkey"
            columns: ["reception_status_secondary_id"]
            isOneToOne: false
            referencedRelation: "reception_items"
            referencedColumns: ["id"]
          },
        ]
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
          list_type: string
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
          list_type?: string
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
          list_type?: string
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
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
      app_role:
        | "admin"
        | "user"
        | "reception"
        | "pending"
        | "manager"
        | "fnb"
        | "housekeeper"
        | "maintenance"
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
    Enums: {
      app_role: [
        "admin",
        "user",
        "reception",
        "pending",
        "manager",
        "fnb",
        "housekeeper",
        "maintenance",
      ],
    },
  },
} as const
