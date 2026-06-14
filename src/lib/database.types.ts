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
      products: {
        Row: {
          available: boolean
          category: string
          created_at: string
          description: string
          id: string
          image_url: string | null
          is_best_seller: boolean
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
          created_at?: string
          description?: string
          id: string
          image_url?: string | null
          is_best_seller?: boolean
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
          created_at?: string
          description?: string
          id?: string
          image_url?: string | null
          is_best_seller?: boolean
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
    }
    Views: { [_ in never]: never }
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
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
