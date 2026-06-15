'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { Plus, Minus, Lock } from 'lucide-react';
import { useCurrency } from './CurrencyContext';
import { useCart } from './CartContext';
import { useBubble } from './AddToCartBubble';
import { isPricedIn, CURRENCY_NAME } from '@/lib/rates';
import { categoryEmoji, type Product } from '@/lib/products';

interface ProductCardProps {
  product: Product;
  index?: number;
  viewMode?: 'list' | 'grid';
}

export default function ProductCard({ product, index = 0, viewMode = 'list' }: ProductCardProps) {
  const { format, currency } = useCurrency();
  const { addItem, updateQty, items } = useCart();
  const { triggerBubble } = useBubble();

  const cartItem = items.find(i => i.id === product.id);
  const qty = cartItem?.quantity ?? 0;

  // Bloqueo por moneda: si el producto no tiene precio nativo en la moneda
  // activa, NO se convierte — queda bloqueado (no se puede agregar).
  const priced = isPricedIn(product, currency);
  const purchasable = product.available && priced;
  const blockedLabel = `No disponible en ${CURRENCY_NAME[currency]}`;

  const handleAdd = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    addItem(product);
    triggerBubble(rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  const emoji = categoryEmoji[product.category] ?? '🍽️';

  /* ── GRID MODE ── */
  if (viewMode === 'grid') {
    return (
      <motion.article
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(index, 8) * 0.03, duration: 0.25 }}
        className="card overflow-hidden flex flex-col"
        style={{ opacity: purchasable ? 1 : 0.55 }}
      >
        <div className="relative w-full aspect-square flex items-center justify-center text-4xl"
          style={{ background: 'linear-gradient(135deg, var(--surface-2), var(--surface-3))' }}>
          {product.image_url ? (
            <Image src={product.image_url} alt={product.name} fill className="object-cover" sizes="50vw" />
          ) : (
            <span style={{ opacity: 0.5 }}>{emoji}</span>
          )}
          {product.is_best_seller && (
            <span className="absolute top-2 left-2 chip chip-warning" style={{ padding: '2px 8px', fontSize: '10px' }}>
              ★ Top
            </span>
          )}
          {!product.available && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center backdrop-blur-sm">
              <span className="chip chip-soft" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
                Agotado
              </span>
            </div>
          )}
        </div>

        <div className="p-3 flex flex-col flex-1">
          <h3 className="text-[13px] font-semibold leading-tight line-clamp-2" style={{ color: 'var(--text-1)' }}>
            {product.name}
          </h3>
          {product.units && (
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-3)' }}>{product.units}</p>
          )}
          {priced ? (
            <p className="text-[15px] font-bold mt-1.5 t-num" style={{ color: 'var(--text-1)' }}>
              {format(product.price_usd, product.price_cop)}
            </p>
          ) : (
            <p className="text-[12px] font-semibold mt-1.5 flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
              <Lock className="w-3 h-3" /> {blockedLabel}
            </p>
          )}
          <div className="mt-auto pt-2.5">
            {purchasable ? (
              qty > 0 ? (
                <div className="flex items-center justify-between rounded-[10px] py-1 px-1"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                  <button
                    onClick={() => updateQty(product.id, qty - 1)}
                    className="w-11 h-11 rounded-md flex items-center justify-center transition-colors"
                    style={{ color: 'var(--brand)' }}
                    aria-label="Restar"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="text-[13px] font-bold t-num" style={{ color: 'var(--text-1)' }}>{qty}</span>
                  <button
                    onClick={() => addItem(product)}
                    className="w-11 h-11 rounded-md flex items-center justify-center text-white transition-opacity"
                    style={{ background: 'var(--brand)' }}
                    aria-label="Sumar"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <motion.button
                  onClick={handleAdd}
                  whileTap={{ scale: 0.96 }}
                  aria-label={`Agregar ${product.name}`}
                  className="btn btn-primary w-full"
                  style={{ padding: '6px 10px', fontSize: '12px', minHeight: 44 }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar
                </motion.button>
              )
            ) : !product.available ? (
              <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>No disponible</span>
            ) : (
              <span className="text-[11px] inline-flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
                <Lock className="w-3 h-3" /> Bloqueado
              </span>
            )}
          </div>
        </div>
      </motion.article>
    );
  }

  /* ── LIST MODE ── */
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.03, duration: 0.25 }}
      className="card flex items-center gap-3 p-3 transition-all duration-200"
      style={{ opacity: purchasable ? 1 : 0.55 }}
    >
      {/* Image */}
      <div
        className="relative flex-shrink-0 w-[88px] h-[88px] rounded-[12px] overflow-hidden flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, var(--surface-2), var(--surface-3))' }}
      >
        {product.image_url ? (
          <Image src={product.image_url} alt={product.name} fill className="object-cover" sizes="88px" />
        ) : (
          <span className="text-3xl" style={{ opacity: 0.6 }}>{emoji}</span>
        )}
        {product.is_best_seller && (
          <span
            className="absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded leading-none"
            style={{ background: 'var(--accent-soft)', color: '#92400E' }}
          >
            ★ Top
          </span>
        )}
        {!product.available && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center backdrop-blur-sm">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}>
              Agotado
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-[14px] font-semibold leading-tight line-clamp-2" style={{ color: 'var(--text-1)' }}>
          {product.name}
        </h3>
        {product.units && (
          <p className="text-[11.5px] mt-0.5 font-medium" style={{ color: 'var(--text-3)' }}>
            {product.units}
          </p>
        )}
        {product.description && (
          <p className="text-[12px] mt-0.5 line-clamp-1" style={{ color: 'var(--text-2)' }}>
            {product.description}
          </p>
        )}
        <div className="mt-1.5">
          {priced ? (
            <p className="text-[17px] font-bold t-num leading-none" style={{ color: 'var(--text-1)' }}>
              {format(product.price_usd, product.price_cop)}
            </p>
          ) : (
            <p className="text-[12.5px] font-semibold leading-none flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
              <Lock className="w-3 h-3" /> {blockedLabel}
            </p>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="flex-shrink-0">
        {purchasable ? (
          qty > 0 ? (
            <div className="flex items-center gap-1 rounded-[10px] px-1 py-1"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <button
                onClick={() => updateQty(product.id, qty - 1)}
                className="w-11 h-11 rounded-md flex items-center justify-center transition-colors"
                style={{ color: 'var(--brand)' }}
                aria-label="Restar"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="text-[14px] font-bold w-5 text-center t-num" style={{ color: 'var(--text-1)' }}>
                {qty}
              </span>
              <button
                onClick={() => addItem(product)}
                className="w-11 h-11 rounded-md flex items-center justify-center text-white transition-opacity"
                style={{ background: 'var(--brand)' }}
                aria-label="Sumar"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <motion.button
              onClick={handleAdd}
              whileTap={{ scale: 0.94 }}
              aria-label={`Agregar ${product.name}`}
              className="btn btn-primary"
              style={{ padding: '8px 14px', fontSize: '13px', minHeight: 44 }}
            >
              <Plus className="w-4 h-4" />
              Agregar
            </motion.button>
          )
        ) : !product.available ? (
          <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>No disponible</span>
        ) : (
          <span className="text-[11px] inline-flex items-center gap-1" style={{ color: 'var(--text-3)' }}>
            <Lock className="w-3 h-3" /> Bloqueado
          </span>
        )}
      </div>
    </motion.article>
  );
}
