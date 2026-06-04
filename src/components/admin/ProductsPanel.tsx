'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { AnimatePresence } from 'framer-motion';
import { Plus, Search, RefreshCw, Star, Package } from 'lucide-react';
import {
  categories, categoryLabels, categoryEmoji,
  type Product, type ProductCategory,
} from '@/lib/products';
import type { ExchangeRates } from '@/lib/rates';
import ProductEditor from './ProductEditor';

const FALLBACK_RATES: ExchangeRates = { bs_per_usd: 535.28, cop_per_usd: 4200, updated_at: '' };

export default function ProductsPanel() {
  const [products, setProducts] = useState<Product[]>([]);
  const [rates, setRates] = useState<ExchangeRates>(FALLBACK_RATES);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<ProductCategory | 'ALL'>('ALL');
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, rRes] = await Promise.all([fetch('/api/products'), fetch('/api/rates')]);
      if (pRes.ok) setProducts(await pRes.json());
      if (rRes.ok) setRates(await rRes.json());
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  // Filter + group in a single pass over the catalog.
  const grouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map: Partial<Record<ProductCategory, Product[]>> = {};
    for (const p of products) {
      const matchCat = catFilter === 'ALL' || p.category === catFilter;
      const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q);
      if (matchCat && matchSearch) (map[p.category] ??= []).push(p);
    }
    return map;
  }, [products, search, catFilter]);

  const visibleCats = categories.filter(c => (grouped[c]?.length ?? 0) > 0);

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

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3">
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
        <button onClick={load} className="btn btn-ghost" style={{ padding: '10px', border: '1px solid var(--border)' }} aria-label="Recargar">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Category chips */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-2 mb-2">
        <Chip active={catFilter === 'ALL'} onClick={() => setCatFilter('ALL')}>Todas ({products.length})</Chip>
        {categories.map(c => (
          <Chip key={c} active={catFilter === c} onClick={() => setCatFilter(c)}>
            {categoryEmoji[c]} {categoryLabels[c]}
          </Chip>
        ))}
      </div>

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
                <span>{categoryEmoji[cat]}</span> {categoryLabels[cat]}
                <span className="font-normal" style={{ color: 'var(--text-3)' }}>· {grouped[cat]!.length}</span>
              </h3>
              <div className="space-y-2">
                {grouped[cat]!.map(p => (
                  <ProductRow key={p.id} product={p} rates={rates} onClick={() => setEditing(p)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Floating add button */}
      <button
        onClick={() => setCreating(true)}
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
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-semibold border transition-colors whitespace-nowrap"
      style={active
        ? { borderColor: 'var(--brand)', background: 'var(--brand-soft)', color: 'var(--brand-deep)' }
        : { borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-2)' }}
    >
      {children}
    </button>
  );
}

function ProductRow({ product: p, rates, onClick }: { product: Product; rates: ExchangeRates; onClick: () => void }) {
  const cop = Math.round(p.price_usd * rates.cop_per_usd);
  return (
    <button
      onClick={onClick}
      className="w-full card p-2.5 flex items-center gap-3 text-left"
      style={{ opacity: p.available ? 1 : 0.55 }}
    >
      <div className="w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-2)' }}>
        {p.image_url
          ? <Image src={p.image_url} alt="" width={48} height={48} className="object-cover w-full h-full" unoptimized />
          : <span className="text-xl">{categoryEmoji[p.category]}</span>}
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
      </div>
    </button>
  );
}
