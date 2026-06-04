-- Run this migration when connecting Supabase for the first time
-- (or apply individually if the orders table already exists)

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  customer_name TEXT NOT NULL,
  customer_whatsapp TEXT NOT NULL,
  delivery_type TEXT NOT NULL,
  delivery_zone TEXT,
  delivery_cost_cop INTEGER NOT NULL DEFAULT 0,
  delivery_address TEXT,
  items JSONB NOT NULL,
  total_usd DECIMAL(10,2) NOT NULL,
  currency_shown TEXT NOT NULL DEFAULT 'USD',
  payment_method TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente',
  -- Payment proof
  payment_proof_ref TEXT,
  payment_proof_url TEXT,
  -- Wholesale fields
  is_wholesale BOOLEAN NOT NULL DEFAULT false,
  advance_pct INTEGER,
  advance_usd DECIMAL(10,2),
  remaining_usd DECIMAL(10,2),
  scheduled_date DATE,
  scheduled_time TEXT
);

-- If the table already exists, add the missing columns:
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_proof_ref TEXT;
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_wholesale BOOLEAN NOT NULL DEFAULT false;
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS advance_pct INTEGER;
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS advance_usd DECIMAL(10,2);
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS remaining_usd DECIMAL(10,2);
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_date DATE;
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_time TEXT;

-- Enable Row Level Security
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Allow inserts from anon key (customers placing orders)
CREATE POLICY "Allow insert from anon" ON orders FOR INSERT TO anon WITH CHECK (true);

-- Only service_role can read/update (admin uses service_role key via API)
CREATE POLICY "Allow all for service_role" ON orders FOR ALL TO service_role USING (true);
