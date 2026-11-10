/**
 * Métodos de pago que se muestran en los carritos (detal y al mayor) — ahora
 * gestionables desde el panel admin (Ventas → Pagos).
 *
 * Se guardan en Supabase (`payment_methods`) y, si la tabla no responde, se cae
 * a la lista estática de `payments.ts`. Mismo patrón que `categories.ts`.
 */
import { createClient } from '@supabase/supabase-js';
import { paymentMethods as staticMethods, type PaymentMethod } from './payments';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

const readDb = url && (serviceKey || anonKey)
  ? createClient(url, serviceKey || anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;
const writeDb = url && serviceKey
  ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

interface Row {
  id: string;
  label: string;
  icon: string;
  details: Record<string, string>;
  note: string | null;
  active: boolean;
  sort_order: number;
}

function toMethod(r: Row): PaymentMethod {
  return { id: r.id, label: r.label, icon: r.icon, details: r.details ?? {}, note: r.note ?? undefined };
}

/** Todos los métodos, ordenados. Cae al fallback estático si la tabla falla o está vacía. */
export async function listPaymentMethods(includeInactive = false): Promise<PaymentMethod[]> {
  if (!readDb) return staticMethods;
  try {
    const { data, error } = await readDb
      .from('payment_methods')
      .select('id, label, icon, details, note, active, sort_order')
      .order('sort_order', { ascending: true });
    if (error || !data || data.length === 0) return staticMethods;
    const rows = data as unknown as Row[];
    return (includeInactive ? rows : rows.filter(r => r.active !== false)).map(toMethod);
  } catch {
    return staticMethods;
  }
}

/** Crea un método de pago nuevo. El id se deriva del label (slug en snake_case). */
export async function createPaymentMethod(
  label: string,
  icon: string,
): Promise<PaymentMethod | { error: string }> {
  if (!writeDb) return { error: 'Base de datos no configurada' };
  const clean = label.trim();
  if (!clean) return { error: 'El nombre es obligatorio' };
  const id = clean.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `metodo_${Date.now()}`;

  const { data: last } = await writeDb.from('payment_methods').select('sort_order').order('sort_order', { ascending: false }).limit(1);
  const sort_order = ((last?.[0]?.sort_order as number) ?? 0) + 1;

  const row = { id, label: clean, icon: (icon || 'Wallet').trim(), details: {}, active: true, sort_order };
  const { data, error } = await writeDb.from('payment_methods').upsert(row, { onConflict: 'id' }).select().single();
  if (error) return { error: error.message };
  return toMethod(data as unknown as Row);
}

/** Edita label / icono / detalles / nota / orden / activo de un método. */
export async function updatePaymentMethod(
  id: string,
  patch: Partial<Pick<Row, 'label' | 'icon' | 'details' | 'note' | 'sort_order' | 'active'>>,
): Promise<PaymentMethod | { error: string }> {
  if (!writeDb) return { error: 'Base de datos no configurada' };
  const clean: Record<string, unknown> = {};
  if (patch.label != null) clean.label = String(patch.label).trim();
  if (patch.icon != null) clean.icon = String(patch.icon).trim() || 'Wallet';
  if (patch.details != null) clean.details = patch.details;
  if (patch.note !== undefined) clean.note = patch.note?.trim() || null;
  if (patch.sort_order != null) clean.sort_order = patch.sort_order;
  if (patch.active != null) clean.active = patch.active;
  const { data, error } = await writeDb.from('payment_methods').update(clean).eq('id', id).select().single();
  if (error) return { error: error.message };
  return toMethod(data as unknown as Row);
}

/** Elimina un método de pago. */
export async function deletePaymentMethod(id: string): Promise<{ ok: true } | { error: string }> {
  if (!writeDb) return { error: 'Base de datos no configurada' };
  const { error } = await writeDb.from('payment_methods').delete().eq('id', id);
  if (error) return { error: error.message };
  return { ok: true };
}
