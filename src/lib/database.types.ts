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
      app_rates: {
        Row: {
          bs_per_usd: number
          cop_per_usd: number
          id: number
          updated_at: string
        }
        Insert: {
          bs_per_usd: number
          cop_per_usd: number
          id?: number
          updated_at?: string
        }
        Update: {
          bs_per_usd?: number
          cop_per_usd?: number
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          active: boolean
          created_at: string
          emoji: string
          key: string
          label: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          emoji?: string
          key: string
          label: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          emoji?: string
          key?: string
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      customers: {
        Row: {
          first_seen: string
          id: string
          last_order_at: string | null
          last_zone: string | null
          name: string
          notes: string | null
          orders_count: number
          total_spent_usd: number
          whatsapp: string
        }
        Insert: {
          first_seen?: string
          id?: string
          last_order_at?: string | null
          last_zone?: string | null
          name: string
          notes?: string | null
          orders_count?: number
          total_spent_usd?: number
          whatsapp: string
        }
        Update: {
          first_seen?: string
          id?: string
          last_order_at?: string | null
          last_zone?: string | null
          name?: string
          notes?: string | null
          orders_count?: number
          total_spent_usd?: number
          whatsapp?: string
        }
        Relationships: []
      }
      delivery_routes: {
        Row: {
          dest_lat: number | null
          dest_lng: number | null
          distance_m: number
          driver: string
          driver_id: string | null
          order_id: string | null
          ended_at: string | null
          id: string
          last_at: string | null
          last_lat: number | null
          last_lng: number | null
          note: string | null
          points: Json
          started_at: string
          status: string
        }
        Insert: {
          dest_lat?: number | null
          dest_lng?: number | null
          distance_m?: number
          driver: string
          driver_id?: string | null
          order_id?: string | null
          ended_at?: string | null
          id?: string
          last_at?: string | null
          last_lat?: number | null
          last_lng?: number | null
          note?: string | null
          points?: Json
          started_at?: string
          status?: string
        }
        Update: {
          dest_lat?: number | null
          dest_lng?: number | null
          distance_m?: number
          driver?: string
          driver_id?: string | null
          order_id?: string | null
          ended_at?: string | null
          id?: string
          last_at?: string | null
          last_lat?: number | null
          last_lng?: number | null
          note?: string | null
          points?: Json
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      drivers: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          phone: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          phone?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          phone?: string | null
        }
        Relationships: []
      }
      flavors: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      orders: {
        Row: {
          advance_pct: number | null
          advance_usd: number | null
          created_at: string
          currency_shown: string
          customer_name: string
          customer_whatsapp: string
          delivery_address: string | null
          delivery_cost_cop: number
          delivery_type: string
          delivery_zone: string | null
          id: string
          is_wholesale: boolean
          items: Json
          notes: string | null
          payment_method: string
          payment_proof_ref: string | null
          payment_proof_url: string | null
          remaining_usd: number | null
          scheduled_date: string | null
          scheduled_time: string | null
          status: string
          total_cop: number | null
          total_usd: number
        }
        Insert: {
          advance_pct?: number | null
          advance_usd?: number | null
          created_at?: string
          currency_shown?: string
          customer_name: string
          customer_whatsapp: string
          delivery_address?: string | null
          delivery_cost_cop?: number
          delivery_type: string
          delivery_zone?: string | null
          id?: string
          is_wholesale?: boolean
          items: Json
          notes?: string | null
          payment_method: string
          payment_proof_ref?: string | null
          payment_proof_url?: string | null
          remaining_usd?: number | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: string
          total_cop?: number | null
          total_usd: number
        }
        Update: {
          advance_pct?: number | null
          advance_usd?: number | null
          created_at?: string
          currency_shown?: string
          customer_name?: string
          customer_whatsapp?: string
          delivery_address?: string | null
          delivery_cost_cop?: number
          delivery_type?: string
          delivery_zone?: string | null
          id?: string
          is_wholesale?: boolean
          items?: Json
          notes?: string | null
          payment_method?: string
          payment_proof_ref?: string | null
          payment_proof_url?: string | null
          remaining_usd?: number | null
          scheduled_date?: string | null
          scheduled_time?: string | null
          status?: string
          total_cop?: number | null
          total_usd?: number
        }
        Relationships: []
      }
      page_visits: {
        Row: {
          created_at: string
          id: number
          path: string
          referrer: string | null
          visit_date: string
          visit_hour: number
        }
        Insert: {
          created_at?: string
          id?: number
          path?: string
          referrer?: string | null
          visit_date?: string
          visit_hour?: number
        }
        Update: {
          created_at?: string
          id?: number
          path?: string
          referrer?: string | null
          visit_date?: string
          visit_hour?: number
        }
        Relationships: []
      }
      product_flavors: {
        Row: {
          available: boolean
          flavor_id: string
          product_id: string
          sort_order: number
        }
        Insert: {
          available?: boolean
          flavor_id: string
          product_id: string
          sort_order?: number
        }
        Update: {
          available?: boolean
          flavor_id?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: []
      }
      products: {
        Row: {
          available: boolean
          category: string
          cobra_frito: boolean
          created_at: string
          description: string
          has_flavors: boolean
          id: string
          image_url: string | null
          is_best_seller: boolean
          limite_unidades_mayor: number
          name: string
          price_cop: number | null
          price_usd: number
          type: string
          units: string | null
          updated_at: string
          wholesale_price_cop: number | null
          wholesale_price_usd: number
        }
        Insert: {
          available?: boolean
          category: string
          cobra_frito?: boolean
          created_at?: string
          description?: string
          has_flavors?: boolean
          id: string
          image_url?: string | null
          is_best_seller?: boolean
          limite_unidades_mayor?: number
          name: string
          price_cop?: number | null
          price_usd?: number
          type?: string
          units?: string | null
          updated_at?: string
          wholesale_price_cop?: number | null
          wholesale_price_usd?: number
        }
        Update: {
          available?: boolean
          category?: string
          cobra_frito?: boolean
          created_at?: string
          description?: string
          has_flavors?: boolean
          id?: string
          image_url?: string | null
          is_best_seller?: boolean
          limite_unidades_mayor?: number
          name?: string
          price_cop?: number | null
          price_usd?: number
          type?: string
          units?: string | null
          updated_at?: string
          wholesale_price_cop?: number | null
          wholesale_price_usd?: number
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          last_seen: string
          p256dh: string
          role: string | null
          user_agent: string | null
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          last_seen?: string
          p256dh: string
          role?: string | null
          user_agent?: string | null
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          last_seen?: string
          p256dh?: string
          role?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      wholesale_clients: {
        Row: {
          active: boolean
          address: string | null
          area: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          phone: string | null
          route: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          area?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          route?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          area?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          route?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      upsert_customer: {
        Args: {
          p_name: string
          p_total_usd: number
          p_whatsapp: string
          p_zone: string
        }
        Returns: undefined
      }
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
