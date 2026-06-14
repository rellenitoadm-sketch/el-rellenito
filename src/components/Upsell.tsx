'use client';

import Image from 'next/image';
import { Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useCurrency } from './CurrencyContext';
import { useCart } from './CartContext';
import { useProducts } from './ProductsContext';
import { categoryEmoji } from '@/lib/products';

export default function Upsell() {
  const { format } = useCurrency();
  const { addItem, items } = useCart();
  const { products } = useProducts();

  // Bebidas disponibles, best-sellers primero.
  const beveragePool = useMemo(
    () => products
      .filter(p => p.available && p.category === 'BEBIDAS')
      .sort((a, b) => Number(b.is_best_seller) - Number(a.is_best_seller)),
    [products],
  );

  const cartIds = new Set(items.map(i => i.id));
  const upsell = beveragePool.filter(p => !cartIds.has(p.id)).slice(0, 6);

  if (upsell.length === 0) return null;

  return (
    <div className="mt-5 px-4">
      <p className="text-[11px] font-bold uppercase tracking-widest mb-2.5" style={{ color: 'var(--text-3)' }}>
        Combínalo con…
      </p>
      <div className="flex gap-2.5 overflow-x-auto scrollbar-none pb-1" style={{ scrollbarWidth: 'none' }}>
        {upsell.map(p => (
          <div
            key={p.id}
            className="flex-shrink-0 w-[138px] rounded-2xl overflow-hidden border flex flex-col"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          >
            <div className="w-full h-20 flex items-center justify-center text-3xl" style={{ background: 'var(--surface-2)' }}>
              {p.image_url ? (
                <Image src={p.image_url} alt={p.name} width={138} height={80} className="object-cover w-full h-full" />
              ) : (
                <span>{categoryEmoji[p.category]}</span>
              )}
            </div>
            <div className="p-2.5 flex flex-col flex-1">
              <p
                className="text-[12px] font-semibold leading-snug line-clamp-2"
                style={{ color: 'var(--text-1)', minHeight: '2.4em' }}
              >
                {p.name}
              </p>
              <p className="text-[13.5px] font-bold mt-1 t-num" style={{ color: 'var(--text-1)' }}>
                {format(p.price_usd, p.price_cop)}
              </p>
              <button
                onClick={() => addItem(p)}
                aria-label={`Agregar ${p.name}`}
                className="mt-3 w-full inline-flex items-center justify-center gap-1 text-[12px] font-bold rounded-lg py-1.5 transition-colors active:scale-[0.97]"
                style={{ background: 'var(--brand-soft)', color: 'var(--brand-deep)' }}
              >
                <Plus className="w-3.5 h-3.5" /> Agregar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
