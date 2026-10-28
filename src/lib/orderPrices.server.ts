import type { SupabaseClient } from '@supabase/supabase-js';
import { WHOLESALE_MIN_QTY } from './rates';
import { FRITO_SURCHARGE } from './fritos';

/** Margen para redondeos de centavos entre el navegador y la base de datos. */
const EPS = 0.011;

interface WebItem { id?: unknown; qty?: unknown; price_usd?: unknown; fritos?: unknown }

/**
 * Comprueba que los precios de un pedido de la página sean los del catálogo.
 * El navegador manda el precio de cada línea; sin esto, alguien podía mandar un
 * tequeño a $0.01 con un total "coherente". Devuelve `null` si todo cuadra, o el
 * mensaje para el cliente si no (normalmente: el catálogo cambió mientras armaba el pedido).
 *
 * Reglas (las mismas de la tienda, ver lib/rates.ts y CartContext):
 * - Línea = `producto` o `producto::sabor`. Precio del sabor si lo tiene; si no, el del producto.
 * - Pedido normal: desde el mínimo del producto (por defecto 10) se cobra el precio al mayor.
 * - Página de mayoristas: siempre precio al mayor.
 * - Fritos: recargo por unidad solo en productos que lo admiten.
 * Si la consulta al catálogo falla, NO se bloquea la venta (se deja pasar y queda en el log).
 */
export async function verifyWebPrices(
  db: SupabaseClient | null,
  rawItems: unknown,
  totalUsd: number,
  isWholesalePage: boolean,
): Promise<string | null> {
  if (!db || !Array.isArray(rawItems)) return null;
  const items = rawItems as WebItem[];

  const ids = items.map(i => (typeof i.id === 'string' ? i.id : ''));
  if (ids.some(id => !id)) return 'Tu carrito está desactualizado. Recarga la página y vuelve a armar el pedido.';
  const productIds = [...new Set(ids.map(id => id.split('::')[0]))];

  const { data: products, error } = await db
    .from('products')
    .select('id, price_usd, wholesale_price_usd, limite_unidades_mayor, cobra_frito')
    .in('id', productIds);
  if (error || !products) { console.warn('verifyWebPrices:', error?.message); return null; }
  const byId = new Map(products.map(p => [p.id as string, p]));

  const flavored = ids.filter(id => id.includes('::')).map(id => id.split('::')[0]);
  const { data: pfRows, error: pfErr } = flavored.length
    ? await db.from('product_flavors')
      .select('product_id, flavor_id, price_usd, wholesale_price_usd')
      .in('product_id', [...new Set(flavored)])
    : { data: [], error: null };
  if (pfErr) { console.warn('verifyWebPrices flavors:', pfErr.message); return null; }
  const pf = new Map((pfRows ?? []).map(r => [`${r.product_id}::${r.flavor_id}`, r]));

  let expected = 0;
  for (const it of items) {
    const id = it.id as string;
    const [pid] = id.split('::');
    const p = byId.get(pid);
    if (!p) return 'Uno de los productos ya no existe. Recarga la página para ver el catálogo actualizado.';
    const f = id.includes('::') ? pf.get(id) : undefined;
    if (id.includes('::') && !f) return 'Uno de los sabores ya no está disponible. Recarga la página.';

    const qty = it.qty as number;
    const price = it.price_usd as number;
    const retail = Number(f?.price_usd ?? p.price_usd);
    const wholesale = Number(f?.wholesale_price_usd ?? p.wholesale_price_usd);
    const limit = p.limite_unidades_mayor != null && p.limite_unidades_mayor > 0 ? p.limite_unidades_mayor : WHOLESALE_MIN_QTY;

    const accepted = isWholesalePage
      // La página de mayoristas usa el precio al mayor (o el del sabor si no tiene uno al mayor).
      ? [wholesale, Number(f?.wholesale_price_usd ?? f?.price_usd ?? p.wholesale_price_usd)]
      : [qty >= limit ? wholesale : retail];
    if (!accepted.some(a => Math.abs(a - price) <= EPS)) {
      return 'Los precios se actualizaron mientras armabas tu pedido. Recarga la página y revisa el total antes de enviar.';
    }
    const frito = p.cobra_frito && it.fritos === true ? FRITO_SURCHARGE.usd : 0;
    expected += (price + frito) * qty;
  }

  if (totalUsd < expected - 0.05) {
    return 'El total no coincide con los precios del catálogo. Recarga la página y vuelve a intentarlo.';
  }
  return null;
}
