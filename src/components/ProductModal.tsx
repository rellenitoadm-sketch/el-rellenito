'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Plus, Lock } from 'lucide-react';
import type { Product } from '@/lib/products';
import { useCurrency } from './CurrencyContext';
import { isPricedIn, CURRENCY_NAME } from '@/lib/rates';
import { FRITO_SURCHARGE } from '@/lib/fritos';

/**
 * Modal de descripción de producto, compartido por el catálogo Al Detal y la
 * página Al Mayor. Cada flujo abre el modal con su propia acción de "agregar"
 * (carrito global vs. carrito mayorista) vía `open(product, onAdd)`.
 */
/** Precio a mostrar en el modal cuando difiere del detal (p.ej. al mayor). */
interface PriceOverride {
  price_usd: number;
  price_cop?: number | null;
}

interface OpenOptions {
  priceOverride?: PriceOverride;
  /** Mostrar el interruptor de servicio de fritos (solo venta individual). */
  allowFritos?: boolean;
}

interface ProductModalContextValue {
  open: (product: Product, onAdd: (opts: { fritos: boolean }) => void, opts?: OpenOptions) => void;
  close: () => void;
}

const ProductModalContext = createContext<ProductModalContextValue | null>(null);

interface ModalState {
  product: Product;
  onAdd: (opts: { fritos: boolean }) => void;
  priceOverride?: PriceOverride;
  allowFritos?: boolean;
}

export function ProductModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ModalState | null>(null);

  const open = useCallback(
    (product: Product, onAdd: (opts: { fritos: boolean }) => void, opts?: OpenOptions) =>
      setState({ product, onAdd, priceOverride: opts?.priceOverride, allowFritos: opts?.allowFritos }),
    [],
  );
  const close = useCallback(() => setState(null), []);

  return (
    <ProductModalContext.Provider value={{ open, close }}>
      {children}
      <AnimatePresence>
        {state && (
          <ProductModalView
            product={state.product}
            onAdd={state.onAdd}
            priceOverride={state.priceOverride}
            allowFritos={state.allowFritos}
            onClose={close}
          />
        )}
      </AnimatePresence>
    </ProductModalContext.Provider>
  );
}

export function useProductModal() {
  const ctx = useContext(ProductModalContext);
  if (!ctx) throw new Error('useProductModal must be inside ProductModalProvider');
  return ctx;
}

function ProductModalView({
  product,
  onAdd,
  priceOverride,
  allowFritos,
  onClose,
}: {
  product: Product;
  onAdd: (opts: { fritos: boolean }) => void;
  priceOverride?: PriceOverride;
  allowFritos?: boolean;
  onClose: () => void;
}) {
  const { format, currency } = useCurrency();
  const [fritos, setFritos] = useState(false);

  const priced = isPricedIn(product, currency);
  const purchasable = product.available && priced;
  const showFritos = !!allowFritos && !!product.cobra_frito;
  const displayUsd = priceOverride ? priceOverride.price_usd : product.price_usd;
  const displayCop = priceOverride ? priceOverride.price_cop : product.price_cop;

  // Cerrar con Escape + bloquear el scroll del fondo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const handleAdd = () => {
    if (!purchasable) return;
    onAdd({ fritos: showFritos ? fritos : false });
    onClose();
  };

  const placeholder = product.name.charAt(0).toUpperCase();

  return (
    <div className="fixed inset-0 z-[75] flex items-end sm:items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.5)' }}
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={product.name}
        initial={{ y: '100%', opacity: 0.6 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0.6 }}
        transition={{ type: 'spring', damping: 32, stiffness: 320 }}
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col"
        style={{ background: 'var(--surface)', maxHeight: '90vh' }}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center"
          style={{ background: 'var(--surface)', color: 'var(--text-2)', boxShadow: 'var(--sh-1)' }}
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Imagen / placeholder */}
        <div
          className="relative w-full aspect-[4/3] flex items-center justify-center text-6xl flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--surface-2), var(--surface-3))' }}
        >
          {product.image_url ? (
            <Image src={product.image_url} alt={product.name} fill className="object-cover" sizes="100vw" />
          ) : (
            <span className="font-bold" style={{ opacity: 0.4 }}>{placeholder}</span>
          )}
          {product.is_best_seller && (
            <span className="absolute top-3 left-3 chip chip-warning" style={{ padding: '3px 10px', fontSize: '11px' }}>
              ★ Top
            </span>
          )}
        </div>

        <div className="p-5 overflow-y-auto">
          <h2 className="t-h2" style={{ color: 'var(--text-1)' }}>{product.name}</h2>
          {product.units && (
            <p className="text-[13px] mt-1 font-medium" style={{ color: 'var(--text-3)' }}>{product.units}</p>
          )}
          {product.description && (
            <p className="text-[14px] mt-3 leading-relaxed" style={{ color: 'var(--text-2)' }}>
              {product.description}
            </p>
          )}

          <div className="mt-4">
            {priced ? (
              <p className="text-[22px] font-bold t-num" style={{ color: 'var(--text-1)' }}>
                {format(displayUsd, displayCop)}
              </p>
            ) : (
              <p className="text-[14px] font-semibold inline-flex items-center gap-1.5" style={{ color: 'var(--text-3)' }}>
                <Lock className="w-4 h-4" /> No disponible en {CURRENCY_NAME[currency]}
              </p>
            )}
          </div>
        </div>

        {/* Footer acción */}
        <div className="px-5 py-3.5 border-t flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
          {showFritos && purchasable && (
            <button
              type="button"
              onClick={() => setFritos(f => !f)}
              aria-pressed={fritos}
              className="w-full flex items-center justify-between gap-3 mb-3 p-3 rounded-xl border transition-colors"
              style={fritos
                ? { background: 'var(--brand-soft)', borderColor: 'var(--brand)' }
                : { background: 'var(--surface-2)', borderColor: 'var(--border)' }}
            >
              <span className="text-left">
                <span className="block text-[14px] font-semibold" style={{ color: 'var(--text-1)' }}>Servicio de fritos</span>
                <span className="block text-[12px]" style={{ color: 'var(--text-3)' }}>
                  +{format(FRITO_SURCHARGE.usd, FRITO_SURCHARGE.cop)} por bandeja
                </span>
              </span>
              <span className="relative w-11 h-6 rounded-full flex-shrink-0 transition-colors" style={{ background: fritos ? 'var(--brand)' : 'var(--surface-3)' }}>
                <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: fritos ? '22px' : '2px' }} />
              </span>
            </button>
          )}
          {purchasable ? (
            <button
              onClick={handleAdd}
              className="btn btn-primary w-full"
              style={{ minHeight: 48, fontSize: 15 }}
            >
              <Plus className="w-4 h-4" />
              Agregar al carrito
            </button>
          ) : !product.available ? (
            <div className="text-center text-[13px] py-2" style={{ color: 'var(--text-3)' }}>Producto agotado</div>
          ) : (
            <div className="text-center text-[13px] py-2 inline-flex items-center justify-center gap-1.5 w-full" style={{ color: 'var(--text-3)' }}>
              <Lock className="w-4 h-4" /> No disponible en {CURRENCY_NAME[currency]}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
