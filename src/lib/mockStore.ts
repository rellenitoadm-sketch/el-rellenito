export type MockOrder = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_whatsapp: string;
  delivery_type: string;
  delivery_zone: string | null;
  delivery_cost_cop: number;
  delivery_address: string | null;
  items: unknown;
  total_usd: number;
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

// Module-level — shared across all imports in the same process (dev/mock mode)
const orders: MockOrder[] = [];

export const mockStore = {
  insert(order: Omit<MockOrder, 'id' | 'created_at'>): MockOrder {
    const row: MockOrder = { ...order, id: `mock-${Date.now()}`, created_at: new Date().toISOString() };
    orders.push(row);
    return row;
  },
  getAll(): MockOrder[] {
    return [...orders];
  },
  updateStatus(id: string, status: string) {
    const o = orders.find(o => o.id === id);
    if (o) o.status = status;
  },
};
