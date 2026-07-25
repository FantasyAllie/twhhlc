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
          hotel_id: string
          id: string
          kind: string
          totals: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          grand_total?: number
          hotel_id?: string
          id?: string
          kind?: string
          totals: Json
          user_id?: string
        }
        Update: {
          created_at?: string
          grand_total?: number
          hotel_id?: string
          id?: string
          kind?: string
          totals?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_snapshots_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      fnb_linen_counts: {
        Row: {
          count: number
          hotel_id: string
          template_item_id: string
          updated_at: string
        }
        Insert: {
          count?: number
          hotel_id?: string
          template_item_id: string
          updated_at?: string
        }
        Update: {
          count?: number
          hotel_id?: string
          template_item_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fnb_linen_counts_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fnb_linen_counts_template_item_id_fkey"
            columns: ["template_item_id"]
            isOneToOne: true
            referencedRelation: "template_items"
            referencedColumns: ["id"]
          },
        ]
      }
      hotel_members: {
        Row: {
          created_at: string
          hotel_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hotel_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          hotel_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotel_members_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      hotels: {
        Row: {
          created_at: string
          id: string
          last_hk_reset_at: string | null
          linen_delivery_days: number[]
          name: string
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_hk_reset_at?: string | null
          linen_delivery_days?: number[]
          name: string
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_hk_reset_at?: string | null
          linen_delivery_days?: number[]
          name?: string
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      lost_property: {
        Row: {
          created_at: string
          created_by_role: string | null
          created_by_username: string | null
          deleted_at: string | null
          found_by_department: string | null
          hotel_id: string
          id: string
          message: string
          photo_paths: string[]
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
          found_by_department?: string | null
          hotel_id?: string
          id?: string
          message: string
          photo_paths?: string[]
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
          found_by_department?: string | null
          hotel_id?: string
          id?: string
          message?: string
          photo_paths?: string[]
          resolved_at?: string | null
          resolved_by_username?: string | null
          room_number?: number | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lost_property_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance_requests: {
        Row: {
          created_at: string
          created_by_username: string | null
          deleted_at: string | null
          done: boolean
          done_at: string | null
          done_by_username: string | null
          hotel_id: string
          id: string
          message: string
          origin_department: string | null
          photo_paths: string[]
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
          hotel_id?: string
          id?: string
          message: string
          origin_department?: string | null
          photo_paths?: string[]
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
          hotel_id?: string
          id?: string
          message?: string
          origin_department?: string | null
          photo_paths?: string[]
          room_number?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_requests_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          checkout_enabled: boolean
          done_enabled: boolean
          messages_enabled: boolean
          notify_from_fnb: boolean
          notify_from_housekeeping: boolean
          notify_from_maintenance: boolean
          notify_from_reception: boolean
          notify_maintenance_requests: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          checkout_enabled?: boolean
          done_enabled?: boolean
          messages_enabled?: boolean
          notify_from_fnb?: boolean
          notify_from_housekeeping?: boolean
          notify_from_maintenance?: boolean
          notify_from_reception?: boolean
          notify_maintenance_requests?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          checkout_enabled?: boolean
          done_enabled?: boolean
          messages_enabled?: boolean
          notify_from_fnb?: boolean
          notify_from_housekeeping?: boolean
          notify_from_maintenance?: boolean
          notify_from_reception?: boolean
          notify_maintenance_requests?: boolean
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
          hotel_id: string
          id: string
          kind: string
          label: string
          sort_order: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hotel_id?: string
          id?: string
          kind: string
          label: string
          sort_order?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          hotel_id?: string
          id?: string
          kind?: string
          label?: string
          sort_order?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reception_items_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      reject_counts: {
        Row: {
          count: number
          hotel_id: string
          id: string
          template_item_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          count?: number
          hotel_id?: string
          id?: string
          template_item_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          count?: number
          hotel_id?: string
          id?: string
          template_item_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reject_counts_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      room_extra_items: {
        Row: {
          created_at: string
          hotel_id: string
          id: string
          name: string
          room_number: number
          user_id: string
        }
        Insert: {
          created_at?: string
          hotel_id?: string
          id?: string
          name: string
          room_number: number
          user_id?: string
        }
        Update: {
          created_at?: string
          hotel_id?: string
          id?: string
          name?: string
          room_number?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_extra_items_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      room_feature_rooms: {
        Row: {
          created_at: string
          feature_id: string
          hotel_id: string
          id: string
          room_number: number
          user_id: string
        }
        Insert: {
          created_at?: string
          feature_id: string
          hotel_id?: string
          id?: string
          room_number: number
          user_id?: string
        }
        Update: {
          created_at?: string
          feature_id?: string
          hotel_id?: string
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
          {
            foreignKeyName: "room_feature_rooms_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      room_features: {
        Row: {
          created_at: string
          hotel_id: string
          id: string
          label: string
          sort_order: number | null
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          created_at?: string
          hotel_id?: string
          id?: string
          label: string
          sort_order?: number | null
          updated_at?: string
          user_id?: string
          value: string
        }
        Update: {
          created_at?: string
          hotel_id?: string
          id?: string
          label?: string
          sort_order?: number | null
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_features_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      room_item_counts: {
        Row: {
          count: number
          hotel_id: string
          id: string
          item_id: string
          item_kind: string
          room_number: number
          updated_at: string
          user_id: string
        }
        Insert: {
          count?: number
          hotel_id?: string
          id?: string
          item_id: string
          item_kind: string
          room_number: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          count?: number
          hotel_id?: string
          id?: string
          item_id?: string
          item_kind?: string
          room_number?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_item_counts_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      room_messages: {
        Row: {
          created_at: string
          created_by_role: string | null
          created_by_username: string | null
          deleted_at: string | null
          dismissed: boolean
          done_at: string | null
          hotel_id: string
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
          created_by_role?: string | null
          created_by_username?: string | null
          deleted_at?: string | null
          dismissed?: boolean
          done_at?: string | null
          hotel_id?: string
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
          created_by_role?: string | null
          created_by_username?: string | null
          deleted_at?: string | null
          dismissed?: boolean
          done_at?: string | null
          hotel_id?: string
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
            foreignKeyName: "room_messages_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
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
          hotel_id: string
          id: string
          label: string
          sort_order: number | null
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          created_at?: string
          hotel_id?: string
          id?: string
          label: string
          sort_order?: number | null
          updated_at?: string
          user_id?: string
          value: string
        }
        Update: {
          created_at?: string
          hotel_id?: string
          id?: string
          label?: string
          sort_order?: number | null
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_types_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          category: string | null
          default_status: string | null
          done: boolean
          done_reception: boolean
          early_check_in: boolean
          early_check_in_at: string | null
          guest_vacated: boolean
          guest_vacated_at: string | null
          hotel_id: string
          housekeeping_note: string | null
          id: string
          needs_maintenance: boolean
          needs_maintenance_at: string | null
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
          early_check_in?: boolean
          early_check_in_at?: string | null
          guest_vacated?: boolean
          guest_vacated_at?: string | null
          hotel_id?: string
          housekeeping_note?: string | null
          id?: string
          needs_maintenance?: boolean
          needs_maintenance_at?: string | null
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
          early_check_in?: boolean
          early_check_in_at?: string | null
          guest_vacated?: boolean
          guest_vacated_at?: string | null
          hotel_id?: string
          housekeeping_note?: string | null
          id?: string
          needs_maintenance?: boolean
          needs_maintenance_at?: string | null
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
            foreignKeyName: "rooms_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rooms_reception_status_secondary_id_fkey"
            columns: ["reception_status_secondary_id"]
            isOneToOne: false
            referencedRelation: "reception_items"
            referencedColumns: ["id"]
          },
        ]
      }
      stayover_photos: {
        Row: {
          created_at: string
          created_by_username: string | null
          hotel_id: string
          id: string
          path: string
          room_number: number
        }
        Insert: {
          created_at?: string
          created_by_username?: string | null
          hotel_id?: string
          id?: string
          path: string
          room_number: number
        }
        Update: {
          created_at?: string
          created_by_username?: string | null
          hotel_id?: string
          id?: string
          path?: string
          room_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "stayover_photos_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      template_item_rooms: {
        Row: {
          created_at: string
          hotel_id: string
          id: string
          room_number: number
          template_item_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hotel_id?: string
          id?: string
          room_number: number
          template_item_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          hotel_id?: string
          id?: string
          room_number?: number
          template_item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_item_rooms_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      template_items: {
        Row: {
          category: string
          color: string | null
          created_at: string
          default_count: number
          hotel_id: string
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
          hotel_id?: string
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
          hotel_id?: string
          id?: string
          list_type?: string
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_items_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
      }
      user_active_hotel: {
        Row: {
          hotel_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          hotel_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          hotel_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_active_hotel_hotel_id_fkey"
            columns: ["hotel_id"]
            isOneToOne: false
            referencedRelation: "hotels"
            referencedColumns: ["id"]
          },
        ]
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
        | "regional_admin"
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
        "regional_admin",
      ],
    },
  },
} as const
