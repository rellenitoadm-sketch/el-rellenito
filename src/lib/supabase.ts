import { createClient } from '@supabase/supabase-js';
import type { Database, Json } from './database.types';
import { mockStore } from './mockStore';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

// Public client (anon key) — customer-facing order inserts + public catalog read.
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient<Database>(supabaseUrl, supabaseAnonKey)
    : null;

// Privileged server-only client (service_role) — bypasses RLS so the admin
// panel can read/update orders, manage products, CRM. NEVER import in client components.
export const supabaseAdmin =
  supabaseUrl && supabaseServiceKey
    ? createClient<Database>(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

export type OrderInsert = {
  customer_name: string;
  customer_whatsapp: string;
  delivery_type: string;
  delivery_zone: string | null;
  delivery_cost_cop: number;
  delivery_address: string | null;
  items: Json;
  total_usd: number;
  total_cop?: number | null;
  currency_shown: string;
  payment_method: string;
  notes: string | null;
  status: string;
  payment_proof_ref?: string | null;
  payment_proof_url?: string | null;
  is_wholesale?: boolean;
  advance_pct?: number | null;
  advance_usd?: number | null;
  remaining_usd?: number | null;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
};

export async function saveOrder(order: OrderInsert): Promise<{ id: string } | null> {
  // Prefer the service_role client: anon can INSERT but has no SELECT policy on
  // orders, so `insert().select()` (RETURNING) would fail RLS. service_role
  // bypasses RLS for the write-and-return in one call.
  const db = supabaseAdmin ?? supabase;
  if (!db) {
    const row = mockStore.insert(order);
    return { id: row.id };
  }
  const { data, error } = await db
    .from('orders')
    .insert([order])
    .select('id')
    .single();
  if (error) {
    console.error('Supabase error:', error);
    return null;
  }
  return data;
}
