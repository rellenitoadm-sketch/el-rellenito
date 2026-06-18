'use client';

import { useMemo } from 'react';
import ProductCard from './ProductCard';
import type { ProductCategory } from '@/lib/products';
import { useProducts } from './ProductsContext';
import { useCategories } from './CategoriesContext';
import type { ViewMode } from './FilterRow';

interface ProductListProps {
  search: string;
  viewMode: ViewMode;
}

export default function ProductList({ search, viewMode }: ProductListProps) {
  const { products } = useProducts();
  const { order, labelOf } = useCategories();
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p => {
      // Catálogo principal = venta al detal (incluye los "ambos")
      const isRetail = p.type === 'detal' || p.type === 'ambos';
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q);
      return isRetail && matchSearch;
    });
  }, [search, products]);

  const grouped = useMemo(() => {
    const map: Partial<Record<ProductCategory, typeof filtered>> = {};
    for (const p of filtered) {
      if (!map[p.category]) map[p.category] = [];
      (map[p.category] as typeof filtered).push(p);
    }
    return map;
  }, [filtered]);

  // Ordena por el orden de categorías dinámico; añade al final cualquier
  // categoría presente en productos que no esté en la lista (defensivo).
  const present = Object.keys(grouped).filter(k => (grouped[k as ProductCategory]?.length ?? 0) > 0);
  const visibleCategories = [
    ...order.filter(c => present.includes(c)),
    ...present.filter(c => !order.includes(c)),
  ];

  if (visibleCategories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <span className="text-5xl mb-4">🔍</span>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No encontramos productos con esa búsqueda.</p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-32 space-y-6 mt-4">
      {visibleCategories.map(cat => (
        <section
          key={cat}
          id={`section-${cat}`}
          aria-labelledby={`heading-${cat}`}
          className="scroll-mt-40"
        >
          <div className="flex items-baseline justify-between mb-3 px-0.5">
            <h2
              id={`heading-${cat}`}
              className="t-h3"
              style={{ color: 'var(--text-1)' }}
            >
              {labelOf(cat)}
            </h2>
            <span className="text-[11px] font-medium" style={{ color: 'var(--text-3)' }}>
              {(grouped[cat] ?? []).length} {(grouped[cat] ?? []).length === 1 ? 'producto' : 'productos'}
            </span>
          </div>
          <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-3' : 'space-y-2.5'}>
            {(grouped[cat] ?? []).map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} viewMode={viewMode} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
