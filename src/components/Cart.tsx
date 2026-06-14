'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Trash2, Plus, Minus } from 'lucide-react';
import Image from 'next/image';
import { useCart } from './CartContext';
import { useCurrency } from './CurrencyContext';
import { unitUsd, unitCop, isWholesaleQty } from '@/lib/rates';
import { categoryEmoji } from '@/lib/products';
import Upsell from './Upsell';
import Checkout from './Checkout';

export default function Cart() {
  const { items, isOpen, closeCart, removeItem, updateQty, totalUsd, itemCount } = useCart();
  const { format, rates } = useCurrency();
  const [showCheckout, setShowCheckout] = useState(false);

  // Cerrar con tecla Escape (accesibilidad / teclado).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeCart(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, closeCart]);

  // Total en COP efectivo: aplica la tarifa al mayor por ítem cuando cantidad >= 10.
  const totalCop = items.reduce((s, i) => s + unitCop(i, i.quantity, rates) * i.quantity, 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50"
            onClick={closeCart}
          />

          {/* Drawer */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Tu pedido"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-hidden"
            style={{ maxHeight: '92vh', background: 'var(--surface)' }}
          >
            {showCheckout ? (
              <div className="flex flex-col h-[92vh]">
                <Checkout onClose={() => { setShowCheckout(false); closeCart(); }} />
              </div>
            ) : (
              <div className="flex flex-col h-[92vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                  <h2 className="font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)' }}>
                    Tu pedido
                    {itemCount > 0 && (
                      <span className="ml-2 text-xs bg-[#FF5100] text-white px-2 py-0.5 rounded-full">
                        {itemCount}
                      </span>
                    )}
                  </h2>
                  <button onClick={closeCart} aria-label="Cerrar carrito" className="p-1 hover:opacity-70 transition-opacity" style={{ color: 'var(--text-muted)' }}>
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Items */}
                <div className="flex-1 overflow-y-auto">
                  {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                      <span className="text-5xl mb-4">🛍️</span>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Tu carrito está vacío.</p>
                      <button onClick={closeCart} className="mt-4 text-[#FF5100] text-sm font-semibold underline">
                        Ver productos
                      </button>
                    </div>
                  ) : (
                    <div className="px-4 mt-4 space-y-3">
                      {items.map(item => (
                        <div key={item.id} className="flex gap-3 rounded-xl p-3 border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                          {/* Image or category emoji */}
                          <div className="w-12 h-12 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0" style={{ background: 'var(--surface-3)' }}>
                            {item.image_url ? (
                              <Image src={item.image_url} alt={item.name} width={48} height={48} className="object-cover w-full h-full" />
                            ) : (
                              <span className="text-xl">{categoryEmoji[item.category] ?? '🍽️'}</span>
                            )}
                          </div>

                          {/* Name on its own full-width line, controls below */}
                          <div className="flex-1 min-w-0 flex flex-col gap-2">
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold leading-tight line-clamp-2" style={{ color: 'var(--text-primary)' }}>{item.name}</p>
                                {isWholesaleQty(item.quantity) && (
                                  <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--brand-soft)', color: 'var(--brand-deep)' }}>
                                    Precio al mayor
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => removeItem(item.id)}
                                className="flex items-center justify-center min-w-[40px] min-h-[40px] -mt-1 -mr-1 text-[#9ca3af] hover:text-[#ef4444] transition-colors flex-shrink-0"
                                aria-label={`Eliminar ${item.name}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-bold text-[#FF5100]">
                                {format(unitUsd(item, item.quantity) * item.quantity, unitCop(item, item.quantity, rates) * item.quantity)}
                              </p>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                  onClick={() => updateQty(item.id, item.quantity - 1)}
                                  className="w-11 h-11 rounded-full flex items-center justify-center transition-colors hover:bg-[var(--brand-orange)] hover:text-white" style={{ background: 'var(--surface-3)', color: 'var(--text-secondary)' }}
                                  aria-label="Restar cantidad"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="text-sm font-bold w-4 text-center" style={{ color: 'var(--text-primary)' }}>{item.quantity}</span>
                                <button
                                  onClick={() => updateQty(item.id, item.quantity + 1)}
                                  className="w-11 h-11 rounded-full bg-[#FF5100] flex items-center justify-center text-white hover:bg-[#e04800] transition-colors"
                                  aria-label="Sumar cantidad"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upsell */}
                  {items.length > 0 && <Upsell />}
                </div>

                {/* Footer */}
                {items.length > 0 && (
                  <div className="px-4 pb-6 pt-3 border-t" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                    <div className="flex items-center justify-between mb-3 px-1">
                      <span className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Subtotal</span>
                      <span className="text-lg font-bold text-[#FF5100]">{format(totalUsd, totalCop)}</span>
                    </div>
                    <button
                      onClick={() => setShowCheckout(true)}
                      className="w-full bg-[#FF5100] hover:bg-[#e04800] active:scale-[0.98] text-white font-bold py-4 rounded-2xl text-base transition-all"
                    >
                      Finalizar pedido
                    </button>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
