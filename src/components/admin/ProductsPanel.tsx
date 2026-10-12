'use client';

import { useState, useEffect, useMemo, useCallback, memo } from 'react';
import Image from 'next/image';
import { AnimatePresence } from 'framer-motion';
import { Plus, Search, RefreshCw, Star, Package, AlertTriangle, DollarSign, Tags, Boxes, PackageX, Wallet } from 'lucide-react';
import { type Product, type ProductCategory } from '@/lib/products';
import { toCop, type ExchangeRates } from '@/lib/rates';
import { useCategories } from '../CategoriesContext';
import ProductEditor from './ProductEditor';
import CategoryManager from './CategoryManager';
import { StockBadge, stockColor } from './StockBadge';
import { stockState, type StockRow } from '@/lib/inventory';

const FALLBACK_RATES: ExchangeRates = { bs_per_usd: 535.28, cop_per_usd: 4200, updated_at: '' };

/** Coacciona a número finito (los precios de la BD pueden venir null o como string). */
const num = (v: unknown): number => {
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : 0;
};

/** Las imágenes de storage se optimizan (miniatura de 48px); los data: URL no se pueden optimizar. */
const isDataUrl = (u: string | null | undefined): boolean => !!u && u.startsWith('data:');

function getMissingFields(p: Product): string[] {
  const missing: string[] = [];
  if (!p.image_url) missing.push('foto');
  if (!p.category?.trim()) missing.push('categoría');
  if (!p.description?.trim()) missing.push('descripción');
  if (!p.price_usd) missing.push('precio USD detal');
  if (p.price_cop == null) missing.push('precio COP detal');
  if (p.type === 'mayorista' || p.type === 'ambos') {
    if (!p.wholesale_price_usd) missing.push('precio USD mayor');
    if (p.wholesale_price_cop == null) missing.push('precio COP mayor');
  }
  return missing;
}

/** Existencia de hoy de un producto: suma de sus filas (una por sabor si tiene sabores). */
interface ProductStock { disponible: number; producido: number; state: ReturnType<typeof stockState> }

function stockOf(rows: StockRow[] | undefined): ProductStock | null {
  if (!rows || rows.length === 0) return null;
  const disponible = rows.reduce((s, r) => s + r.disponible, 0);
  const producido = rows.reduce((s, r) => s + r.producido, 0);
  // Con sabores, basta un sabor agotado o bajo para avisar del producto.
  const states = rows.map(r => stockState(r));
  const state = states.includes('agotado') ? 'agotado' : states.includes('bajo') ? 'bajo' : states.every(x => x === 'sin_cargar') ? 'sin_cargar' : 'ok';
  return { disponible, producido, state };
}

type Filter = ProductCategory | 'ALL' | 'INCOMPLETOS' | 'BAJO' | 'AGOTADOS';

export default function ProductsPanel() {
  const { order, labelOf, emojiOf } = useCategories();
  const [products, setProducts] = useState<Product[]>([]);
  const [rates, setRates] = useState<ExchangeRates>(FALLBACK_RATES);
  const [loading, setLoading] = useState(true);
  const [loadingRates, setLoadingRates] = useState(false);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<Filter>('ALL');
  const [stockRows, setStockRows] = useState<StockRow[] | null>(null); // null = inventario no disponible
  const [stockDate, setStockDate] = useState('');
  const [editing, setEditing] = useState<{ product: Product; tab?: 'stock' } | null>(null);
  const [creating, setCreating] = useState(false);
  const [managingCats, setManagingCats] = useState(false);

  // Sin la migración 006 el inventario falla: la lista sigue funcionando sin existencias.
  const applyInventory = async (res: Response) => {
    if (!res.ok) { setStockRows(null); return; }
    const inv = await res.json() as { date: string; rows: StockRow[] };
    setStockRows(inv.rows);
    setStockDate(inv.date);
  };

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, rRes, iRes] = await Promise.all([fetch('/api/products'), fetch('/api/rates'), fetch('/api/admin/inventory')]);
      if (pRes.ok) setProducts(await pRes.json());
      if (rRes.ok) setRates(await rRes.json());
      await applyInventory(iRes);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  const reloadRates = async () => {
    setLoadingRates(true);
    try {
      // refresh=1 fuerza la consulta en vivo (BCV + COP), ignorando el caché del día.
      const res = await fetch('/api/rates?refresh=1');
      if (res.ok) setRates(await res.json());
    } catch { /* ignore */ } finally { setLoadingRates(false); }
  };

  useEffect(() => { load(); }, []);

  const incompleteProducts = useMemo(() => products.filter(p => getMissingFields(p).length > 0), [products]);

  const stockByProduct = useMemo(() => {
    const map = new Map<string, StockRow[]>();
    for (const r of stockRows ?? []) map.set(r.product_id, [...(map.get(r.product_id) ?? []), r]);
    return map;
  }, [stockRows]);

  const stats = useMemo(() => {
    let bajo = 0, agotado = 0, valor = 0;
    for (const p of products) {
      const st = stockOf(stockByProduct.get(p.id));
      if (!p.available || st?.state === 'agotado') agotado++;
      else if (st?.state === 'bajo') bajo++;
      if (st && st.disponible > 0) valor += st.disponible * num(p.price_usd);
    }
    return { bajo, agotado, valor };
  }, [products, stockByProduct]);

  const matchesFilter = useCallback((p: Product, f: Filter): boolean => {
    if (f === 'ALL') return true;
    if (f === 'INCOMPLETOS') return getMissingFields(p).length > 0;
    const st = stockOf(stockByProduct.get(p.id));
    if (f === 'BAJO') return st?.state === 'bajo';
    if (f === 'AGOTADOS') return !p.available || st?.state === 'agotado';
    return p.category === f;
  }, [stockByProduct]);

  // Filter + group in a single pass over the catalog.
  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map: Partial<Record<ProductCategory, Product[]>> = {};
    for (const p of products) {
      const matchCat = matchesFilter(p, catFilter);
      const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q);
      if (matchCat && matchSearch) (map[p.category] ??= []).push(p);
    }
    return map;
  }, [products, search, catFilter, matchesFilter]);

  const presentCats = Object.keys(grouped).filter(c => (grouped[c as ProductCategory]?.length ?? 0) > 0);
  const visibleCats = [
    ...order.filter(c => presentCats.includes(c)),
    ...presentCats.filter(c => !order.includes(c)),
  ];

  const handleSaved = (saved: Product) => {
    setProducts(prev => {
      const exists = prev.some(p => p.id === saved.id);
      return exists ? prev.map(p => p.id === saved.id ? saved : p) : [saved, ...prev];
    });
    setEditing(null); setCreating(false);
    fetch('/api/admin/inventory').then(applyInventory).catch(() => {}); // umbral y existencias con el producto guardado
  };
  const handleDeleted = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    setEditing(null);
  };
  // Callback estable → con `memo` en ProductRow, editar/guardar un producto no
  // vuelve a renderizar las otras 99 filas (clave para la fluidez en móvil).
  const handleEdit = useCallback((p: Product, tab?: 'stock') => setEditing({ product: p, tab }), []);

  const rateUpdatedAt = rates.updated_at
    ? new Date(rates.updated_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div>
      {/* Barra de tasas — BCV (Bs, oficial) y Peso (COP, TRM oficial), siempre visible */}
      <div data-tour="products-rate" className="flex items-center gap-3 rounded-xl px-3 py-2.5 mb-3 border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
        <DollarSign className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--brand)' }} />
        <div className="flex-1 min-w-0 flex flex-wrap items-start gap-x-5 gap-y-1">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Tasa BCV</p>
            <p className="text-[13px] font-bold leading-tight" style={{ color: 'var(--text-1)' }}>
              Bs {num(rates.bs_per_usd).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Tasa Peso · TRM</p>
            <p className="text-[13px] font-bold leading-tight" style={{ color: 'var(--text-1)' }}>
              COP {Math.round(num(rates.cop_per_usd)).toLocaleString('es-CO')}
            </p>
          </div>
          {rateUpdatedAt && <p className="text-[9.5px] w-full" style={{ color: 'var(--text-3)' }}>1 USD · Act. {rateUpdatedAt}</p>}
        </div>
        <button
          onClick={reloadRates}
          disabled={loadingRates}
          className="btn btn-ghost"
          style={{ padding: '8px', minWidth: 44, minHeight: 44, border: '1px solid var(--border)' }}
          aria-label="Recargar tasas"
          title="Recargar tasas (BCV y peso)"
        >
          <RefreshCw className={`w-4 h-4 ${loadingRates ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Resumen de inventario */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3" data-tour="products-kpis">
        <Kpi Icon={Boxes} label="Productos" value={String(products.length)} />
        {stockRows ? (
          <>
            <Kpi Icon={AlertTriangle} label="Stock bajo" value={String(stats.bajo)} tone={stats.bajo > 0 ? 'warn' : undefined} />
            <Kpi Icon={PackageX} label="Agotados" value={String(stats.agotado)} tone={stats.agotado > 0 ? 'bad' : undefined} />
            <Kpi Icon={Wallet} label="Valor en existencia" value={`$${stats.valor.toFixed(0)}`} />
          </>
        ) : (
          <p className="col-span-2 sm:col-span-3 text-[11.5px] self-center" style={{ color: 'var(--text-3)' }}>
            Existencias no disponibles todavía (falta la migración 006 de inventario).
          </p>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3" data-tour="products-toolbar">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-3)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar producto…"
            className="field"
            style={{ paddingLeft: '2.25rem' }}
          />
        </div>
        <button onClick={() => setManagingCats(true)} className="btn btn-ghost" style={{ padding: '10px', minWidth: 44, minHeight: 44, border: '1px solid var(--border)' }} aria-label="Gestionar categorías" title="Gestionar categorías">
          <Tags className="w-4 h-4" />
        </button>
        <button onClick={load} className="btn btn-ghost" style={{ padding: '10px', minWidth: 44, minHeight: 44, border: '1px solid var(--border)' }} aria-label="Recargar productos">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Category chips */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-2 mb-2" data-tour="products-cats">
        <Chip active={catFilter === 'ALL'} onClick={() => setCatFilter('ALL')}>Todas ({products.length})</Chip>
        {stockRows && stats.bajo > 0 && (
          <Chip active={catFilter === 'BAJO'} onClick={() => setCatFilter('BAJO')}>Stock bajo ({stats.bajo})</Chip>
        )}
        {stats.agotado > 0 && (
          <Chip active={catFilter === 'AGOTADOS'} onClick={() => setCatFilter('AGOTADOS')}>Agotados ({stats.agotado})</Chip>
        )}
        {incompleteProducts.length > 0 && (
          <button
            onClick={() => setCatFilter('INCOMPLETOS')}
            className="flex-shrink-0 px-3 py-1.5 min-h-11 rounded-full text-[12px] font-semibold border transition-colors whitespace-nowrap inline-flex items-center gap-1"
            style={catFilter === 'INCOMPLETOS'
              ? { borderColor: '#D97706', background: '#FEF9C3', color: '#B45309' }
              : { borderColor: '#FCD34D', background: '#FFFBEB', color: '#92400E' }}
          >
            <AlertTriangle className="w-3 h-3" /> Incompletos ({incompleteProducts.length})
          </button>
        )}
        {order.map(c => (
          <Chip key={c} active={catFilter === c} onClick={() => setCatFilter(c)}>
            {labelOf(c)}
          </Chip>
        ))}
      </div>

      {catFilter === 'INCOMPLETOS' && incompleteProducts.length > 0 && (
        <p className="text-[11px] mb-3 flex items-center gap-1" style={{ color: '#92400E' }}>
          <AlertTriangle className="w-3 h-3" /> Estos productos necesitan información. Toca uno para editarlo.
        </p>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--brand)' }} /></div>
      ) : visibleCats.length === 0 ? (
        <div className="card text-center py-14 px-6">
          <Package className="w-9 h-9 mx-auto mb-3" style={{ color: 'var(--text-3)' }} />
          <p className="text-[14px] font-semibold" style={{ color: 'var(--text-1)' }}>Sin productos</p>
          <p className="text-[12px] mt-1" style={{ color: 'var(--text-3)' }}>Crea el primero con el botón +.</p>
        </div>
      ) : (
        <div className="space-y-5 pb-24">
          {visibleCats.map(cat => (
            <section key={cat}>
              <h3 className="text-[12px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-2)' }}>
                {labelOf(cat)}
                <span className="font-normal" style={{ color: 'var(--text-3)' }}>· {grouped[cat]!.length}</span>
              </h3>
              <div className="space-y-2">
                {grouped[cat]!.map(p => (
                  <ProductRow
                    key={p.id}
                    product={p}
                    rates={rates}
                    emoji={emojiOf(p.category)}
                    onEdit={handleEdit}
                    stock={stockOf(stockByProduct.get(p.id))}
                    showMissing={catFilter === 'INCOMPLETOS'}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Floating add button */}
      <button
        onClick={() => setCreating(true)}
        data-tour="products-add"
        className="fixed bottom-5 right-5 z-40 w-14 h-14 rounded-full btn-gradient glow-orange flex items-center justify-center shadow-xl"
        aria-label="Nuevo producto"
      >
        <Plus className="w-6 h-6 text-white" />
      </button>

      <AnimatePresence>
        {(editing || creating) && (
          <ProductEditor
            product={editing?.product ?? null}
            initialTab={editing?.tab}
            rates={rates}
            stockRows={stockRows ? (stockByProduct.get(editing?.product.id ?? '') ?? []) : null}
            stockDate={stockDate}
            onStockRows={setStockRows}
            onClose={() => { setEditing(null); setCreating(false); }}
            onSaved={handleSaved}
            onDeleted={handleDeleted}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {managingCats && <CategoryManager onClose={() => setManagingCats(false)} />}
      </AnimatePresence>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 px-3 py-1.5 min-h-11 rounded-full text-[12px] font-semibold border transition-colors whitespace-nowrap"
      style={active
        ? { borderColor: 'var(--brand)', background: 'var(--brand-soft)', color: 'var(--brand-deep)' }
        : { borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-2)' }}
    >
      {children}
    </button>
  );
}

function Kpi({ Icon, label, value, tone }: { Icon: React.ElementType; label: string; value: string; tone?: 'warn' | 'bad' }) {
  const look = tone === 'bad' ? { bg: 'var(--danger-soft)', fg: '#B91C1C' }
    : tone === 'warn' ? { bg: 'var(--warning-soft)', fg: '#B45309' }
    : { bg: 'var(--surface)', fg: 'var(--text-1)' };
  return (
    <div className="card p-3" style={{ background: look.bg }}>
      <Icon className="w-4 h-4 mb-1" style={{ color: look.fg, opacity: 0.8 }} aria-hidden />
      <p className="text-[11px]" style={{ color: look.fg, opacity: 0.8 }}>{label}</p>
      <p className="text-[19px] font-bold t-num leading-tight" style={{ color: look.fg }}>{value}</p>
    </div>
  );
}

const ProductRow = memo(function ProductRow({ product: p, rates, emoji, onEdit, stock, showMissing }: {
  product: Product; rates: ExchangeRates; emoji: string; onEdit: (p: Product, tab?: 'stock') => void;
  stock: ProductStock | null; showMissing?: boolean;
}) {
  // Formateo blindado: ningún precio null/raro puede tumbar la lista.
  const priceUsd = num(p.price_usd);
  const cop = num(toCop(priceUsd, p.price_cop, rates));
  const missing = showMissing ? getMissingFields(p) : undefined;
  const state = !p.available ? 'agotado' : stock?.state;
  const pct = stock && stock.producido > 0 ? Math.max(0, Math.min(100, (stock.disponible / stock.producido) * 100)) : 0;
  return (
    <div className="card flex items-stretch overflow-hidden" style={{ opacity: p.available ? 1 : 0.6 }}>
      <button onClick={() => onEdit(p)} className="flex-1 min-w-0 p-2.5 flex items-center gap-3 text-left" aria-label={`Editar ${p.name}`}>
        <div className="w-11 h-11 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-2)' }}>
          {p.image_url
            ? <Image src={p.image_url} alt="" width={44} height={44} sizes="44px" className="object-cover w-full h-full" unoptimized={isDataUrl(p.image_url)} />
            : <span className="text-lg">{emoji}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[13.5px] font-semibold truncate" style={{ color: 'var(--text-1)' }}>{p.name}</p>
            {p.is_best_seller && <Star className="w-3 h-3 fill-current flex-shrink-0" style={{ color: 'var(--accent)' }} aria-label="Destacado" />}
          </div>
          <p className="text-[11px] truncate t-num" style={{ color: 'var(--text-3)' }}>
            {p.units ? `${p.units} · ` : ''}<span className="font-bold" style={{ color: 'var(--brand)' }}>${priceUsd.toFixed(2)}</span> · COP {cop.toLocaleString('es-CO')}
          </p>
          {missing && missing.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {missing.map(m => (
                <span key={m} className="text-[9.5px] px-1.5 py-0.5 rounded-md font-semibold" style={{ background: '#FEF9C3', color: '#854D0E' }}>
                  Sin {m}
                </span>
              ))}
            </div>
          )}
        </div>
      </button>
      {/* Existencia de hoy: toca para cargar producción o registrar mermas */}
      <button
        onClick={() => onEdit(p, 'stock')}
        data-tour="product-stock"
        className="w-[84px] flex-shrink-0 px-2 flex flex-col items-center justify-center border-l"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-2)', minHeight: 64 }}
        aria-label={`Existencia de ${p.name}`}
      >
        {stock && p.available ? (
          <>
            <span className="text-[18px] font-bold t-num leading-none" style={{ color: 'var(--text-1)' }}>{stock.disponible}</span>
            <span className="block w-full h-1.5 rounded-full mt-1.5 overflow-hidden" style={{ background: 'var(--border)' }} aria-hidden>
              <span className="block h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pct}%`, background: stockColor(stock.state) }} />
            </span>
            <StockBadge state={stock.state} />
          </>
        ) : state === 'agotado' ? (
          <StockBadge state="agotado" />
        ) : (
          <span className="text-[10.5px] font-semibold" style={{ color: 'var(--text-3)' }}>Existencia</span>
        )}
      </button>
    </div>
  );
});
