/**
 * Categorías del catálogo — ahora gestionables desde el panel admin.
 *
 * Se guardan en Supabase (`categories`) y, si la tabla no responde, se cae a la
 * lista estática de `products.ts`. Cliente Supabase sin genérico tipado a
 * propósito (la tabla no está en `database.types.ts`).
 */
import { createClient } from '@supabase/supabase-js';
import { categories as staticCats, categoryLabels, categoryEmoji } from './products';
import { slugify } from './slugify';

export interface CategoryMeta {
  key: string;
  label: string;
  emoji: string;
  sort_order: number;
  active: boolean;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Lectura: service_role si está, si no anon (RLS permite SELECT).
const readDb = url && (serviceKey || anonKey)
  ? createClient(url, serviceKey || anonKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;
// Escritura: solo service_role (bypassa RLS).
const writeDb = url && serviceKey
  ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

/** Lista estática de respaldo (las 9 categorías base). */
export function staticCategories(): CategoryMeta[] {
  return staticCats.map((key, i) => ({
    key,
    label: categoryLabels[key] ?? key,
    emoji: categoryEmoji[key] ?? '🍽️',
    sort_order: i + 1,
    active: true,
  }));
}

/** Todas las categorías, ordenadas. Cae al fallback estático si la tabla falla. */
export async function listCategories(includeInactive = false): Promise<CategoryMeta[]> {
  if (!readDb) return staticCategories();
  try {
    const { data, error } = await readDb
      .from('categories')
      .select('key, label, emoji, sort_order, active')
      .order('sort_order', { ascending: true });
    if (error || !data || data.length === 0) return staticCategories();
    const rows = data as CategoryMeta[];
    return includeInactive ? rows : rows.filter(r => r.active !== false);
  } catch {
    return staticCategories();
  }
}

/** Crea una categoría nueva. La key se deriva del label (slug en MAYÚSCULAS). */
export async function createCategory(label: string, emoji: string): Promise<CategoryMeta | { error: string }> {
  if (!writeDb) return { error: 'Base de datos no configurada' };
  const clean = label.trim();
  if (!clean) return { error: 'El nombre es obligatorio' };
  const key = (slugify(clean) || clean).toUpperCase();

  // sort_order = al final.
  const { data: last } = await writeDb.from('categories').select('sort_order').order('sort_order', { ascending: false }).limit(1);
  const sort_order = ((last?.[0]?.sort_order as number) ?? 0) + 1;

  const row = { key, label: clean, emoji: (emoji || '🍽️').trim(), sort_order, active: true };
  const { data, error } = await writeDb.from('categories').upsert(row, { onConflict: 'key' }).select().single();
  if (error) return { error: error.message };
  return data as CategoryMeta;
}

/** Edita label / emoji / orden / activo de una categoría. */
export async function updateCategory(
  key: string,
  patch: Partial<Pick<CategoryMeta, 'label' | 'emoji' | 'sort_order' | 'active'>>,
): Promise<CategoryMeta | { error: string }> {
  if (!writeDb) return { error: 'Base de datos no configurada' };
  const clean: Record<string, unknown> = {};
  if (patch.label != null) clean.label = String(patch.label).trim();
  if (patch.emoji != null) clean.emoji = String(patch.emoji).trim() || '🍽️';
  if (patch.sort_order != null) clean.sort_order = patch.sort_order;
  if (patch.active != null) clean.active = patch.active;
  const { data, error } = await writeDb.from('categories').update(clean).eq('key', key).select().single();
  if (error) return { error: error.message };
  return data as CategoryMeta;
}

/** Elimina una categoría. Bloquea si hay productos usándola. */
export async function deleteCategory(key: string): Promise<{ ok: true } | { error: string; inUse?: number }> {
  if (!writeDb) return { error: 'Base de datos no configurada' };
  const { count } = await writeDb.from('products').select('id', { count: 'exact', head: true }).eq('category', key);
  if (typeof count === 'number' && count > 0) {
    return { error: `No se puede eliminar: ${count} producto(s) usan esta categoría. Muévelos primero.`, inUse: count };
  }
  const { error } = await writeDb.from('categories').delete().eq('key', key);
  if (error) return { error: error.message };
  return { ok: true };
}
