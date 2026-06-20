'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { AnimatePresence } from 'framer-motion';
import { Plus, Search, RefreshCw, Star, Package, AlertTriangle, DollarSign, Tags } from 'lucide-react';
import { type Product, type ProductCategory } from '@/lib/products';
import { toCop, type ExchangeRates } from '@/lib/rates';
import { useCategories } from '../CategoriesContext';
import ProductEditor from './ProductEditor';
import CategoryManager from './CategoryManager';

const FALLBACK_RATES: ExchangeRates = { bs_per_usd: 535.28, cop_per_usd: 4200, updated_at: '' };

function getMissingFields(p: Product): string[] {
  const missing: string[] = [];
  if (!p.units?.trim()) missing.push('unidades');
  if (!p.description?.trim()) missing.push('descripción');
  if (!p.price_usd) missing.push('precio USD detal');
  if (p.price_cop == null) missing.push('precio COP detal');
  if (p.type === 'mayorista' || p.type === 'ambos') {
    if (!p.wholesale_price_usd) missing.push('precio USD mayor');
    if (p.wholesale_price_cop == null) missing.push('precio COP mayor');
  }
  return missing;
}

export default function ProductsPanel() {
  const { order, labelOf, emojiOf } = useCategories();
  const [products, setProducts] = useState<Product[]>([]);
  const [rates, setRates] = useState<ExchangeRates>(FALLBACK_RATES);
  const [loading, setLoading] = useState(true);
  const [loadingRates, setLoadingRates] = useState(false);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<ProductCategory | 'ALL' | 'INCOMPLETOS'>('ALL');
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);
  const [managingCats, setManagingCats] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, rRes] = await Promise.all([fetch('/api/products'), fetch('/api/rates')]);
      if (pRes.ok) setProducts(await pRes.json());
      if (rRes.ok) setRates(await rRes.json());
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

  // Filter + group in a single pass over the catalog.
  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map: Partial<Record<ProductCategory, Product[]>> = {};
    const source = catFilter === 'INCOMPLETOS' ? incompleteProducts : products;
    for (const p of source) {
      const matchCat = catFilter === 'ALL' || catFilter === 'INCOMPLETOS' || p.category === catFilter;
      const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q);
      if (matchCat && matchSearch) (map[p.category] ??= []).push(p);
    }
    return map;
  }, [products, search, catFilter, incompleteProducts]);

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
  };
  const handleDeleted = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    setEditing(null);
  };

  const rateUpdatedAt = rates.updated_at
    ? new Date(rates.updated_at).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div>
      {/* BCV Rate bar — siempre visible */}
      <div data-tour="products-rate" className="flex items-center gap-3 rounded-xl px-3 py-2.5 mb-3 border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
        <DollarSign className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--brand)' }} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-3)' }}>Tasa BCV</p>
          <p className="text-[13px] font-bold leading-tight" style={{ color: 'var(--text-1)' }}>
            1 USD = Bs {rates.bs_per_usd.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-[11px] font-normal ml-2" style={{ color: 'var(--text-3)' }}>
              · COP {Math.round(rates.cop_per_usd).toLocaleString('es-CO')}
            </span>
          </p>
          {rateUpdatedAt && <p className="text-[9.5px]" style={{ color: 'var(--text-3)' }}>Act. {rateUpdatedAt}</p>}
        </div>
        <button
          onClick={reloadRates}
          disabled={loadingRates}
          className="btn btn-ghost"
          style={{ padding: '8px', minWidth: 44, minHeight: 44, border: '1px solid var(--border)' }}
          aria-label="Recargar tasa BCV"
          title="Recargar tasa BCV"
        >
          <RefreshCw className={`w-4 h-4 ${loadingRates ? 'animate-spin' : ''}`} />
        </button>
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
                    onClick={() => setEditing(p)}
                    missing={catFilter === 'INCOMPLETOS' ? getMissingFields(p) : undefined}
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
            product={editing}
            rates={rates}
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

function ProductRow({ product: p, rates, emoji, onClick, missing }: { product: Product; rates: ExchangeRates; emoji: string; onClick: () => void; missing?: string[] }) {
  const cop = toCop(p.price_usd, p.price_cop, rates);
  return (
    <button
      onClick={onClick}
      className="w-full card p-2.5 flex items-center gap-3 text-left"
      style={{ opacity: p.available ? 1 : 0.55 }}
    >
      <div className="w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-2)' }}>
        {p.image_url
          ? <Image src={p.image_url} alt="" width={48} height={48} className="object-cover w-full h-full" unoptimized />
          : <span className="text-xl">{emoji}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-[13.5px] font-semibold truncate" style={{ color: 'var(--text-1)' }}>{p.name}</p>
          {p.is_best_seller && <Star className="w-3 h-3 fill-current flex-shrink-0" style={{ color: 'var(--accent)' }} />}
        </div>
        {p.units && <p className="text-[11px]" style={{ color: 'var(--text-3)' }}>{p.units}</p>}
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[12.5px] font-bold" style={{ color: 'var(--brand)' }}>${p.price_usd.toFixed(2)}</span>
          <span className="text-[10.5px]" style={{ color: 'var(--text-3)' }}>· COP {cop.toLocaleString('es-CO')}</span>
          {!p.available && <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--danger-soft)', color: '#B91C1C' }}>Agotado</span>}
        </div>
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
  );
}
