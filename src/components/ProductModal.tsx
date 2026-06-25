'use client';

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Plus, Minus, Lock, Flame, Loader2 } from 'lucide-react';
import type { Product } from '@/lib/products';
import type { Flavor } from '@/lib/flavors';
import { useCurrency } from './CurrencyContext';
import { useCart } from './CartContext';
import { isPricedIn, CURRENCY_NAME } from '@/lib/rates';
import { FRITO_SURCHARGE } from '@/lib/fritos';

/**
 * Modal de descripción de producto, compartido por el catálogo Al Detal y la
 * página Al Mayor. Cada flujo abre el modal con su propia acción de "agregar"
 * (carrito global vs. carrito mayorista) vía `open(product, onAdd)`.
 * Si el producto usa sabores (y se permite con `allowFlavors`), el modal muestra
 * selección de cantidades por sabor y agrega cada sabor como su propia línea.
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
  /** Permitir elegir sabores (solo flujo al detal con el carrito global). */
  allowFlavors?: boolean;
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
  allowFlavors?: boolean;
}

export function ProductModalProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ModalState | null>(null);

  const open = useCallback(
    (product: Product, onAdd: (opts: { fritos: boolean }) => void, opts?: OpenOptions) =>
      setState({ product, onAdd, priceOverride: opts?.priceOverride, allowFritos: opts?.allowFritos, allowFlavors: opts?.allowFlavors }),
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
            allowFlavors={state.allowFlavors}
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
  allowFlavors,
  onClose,
}: {
  product: Product;
  onAdd: (opts: { fritos: boolean }) => void;
  priceOverride?: PriceOverride;
  allowFritos?: boolean;
  allowFlavors?: boolean;
  onClose: () => void;
}) {
  const { format, currency } = useCurrency();
  const { addItem } = useCart();
  const [fritos, setFritos] = useState(false);

  const priced = isPricedIn(product, currency);
  const purchasable = product.available && priced;
  const showFritos = !!allowFritos && !!product.cobra_frito;
  const displayUsd = priceOverride ? priceOverride.price_usd : product.price_usd;
  const displayCop = priceOverride ? priceOverride.price_cop : product.price_cop;

  // Sabores (solo flujo al detal). Se cargan al abrir si el producto los usa.
  const flavorsRequested = !!allowFlavors && !!product.has_flavors;
  const [flavors, setFlavors] = useState<Flavor[] | null>(flavorsRequested ? null : []);
  const [qtys, setQtys] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!flavorsRequested) return;
    let cancelled = false;
    fetch(`/api/products/${product.id}/flavors`)
      .then(r => (r.ok ? r.json() : []))
      .then((data: Flavor[]) => { if (!cancelled) setFlavors(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setFlavors([]); });
    return () => { cancelled = true; };
  }, [flavorsRequested, product.id]);

  const hasFlavorUI = flavorsRequested && flavors !== null && flavors.length > 0;
  const totalFlavorQty = Object.values(qtys).reduce((s, n) => s + n, 0);
  const setQty = (id: string, n: number) => setQtys(q => ({ ...q, [id]: Math.max(0, n) }));

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

  const handleAddFlavors = () => {
    if (!purchasable || totalFlavorQty === 0) return;
    for (const f of flavors ?? []) {
      const n = qtys[f.id] ?? 0;
      if (n > 0) addItem(product, { flavor: { id: f.id, name: f.name }, quantity: n, fritos: showFritos ? fritos : false });
    }
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

          {/* Selección de sabores */}
          {flavorsRequested && purchasable && (
            <div className="mt-5">
              <p className="text-[12px] font-bold uppercase tracking-wider mb-2.5" style={{ color: 'var(--text-3)' }}>
                Elige tus sabores
              </p>
              {flavors === null ? (
                <div className="flex items-center gap-2 text-[13px] py-2" style={{ color: 'var(--text-3)' }}>
                  <Loader2 className="w-4 h-4 animate-spin" /> Cargando sabores…
                </div>
              ) : flavors.length === 0 ? (
                <p className="text-[13px]" style={{ color: 'var(--text-3)' }}>Este producto aún no tiene sabores configurados.</p>
              ) : (
                <div className="space-y-2">
                  {flavors.map(f => {
                    const n = qtys[f.id] ?? 0;
                    return (
                      <div key={f.id} className="flex items-center justify-between gap-3 rounded-xl p-2.5 border" style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}>
                        <span className="text-[14px] font-medium" style={{ color: 'var(--text-1)' }}>{f.name}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => setQty(f.id, n - 1)}
                            disabled={n === 0}
                            className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-40"
                            style={{ background: 'var(--surface)', color: 'var(--brand)', border: '1px solid var(--border)' }}
                            aria-label={`Quitar ${f.name}`}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[14px] font-bold w-5 text-center t-num" style={{ color: 'var(--text-1)' }}>{n}</span>
                          <button
                            onClick={() => setQty(f.id, n + 1)}
                            className="w-9 h-9 rounded-full flex items-center justify-center text-white"
                            style={{ background: 'var(--brand)' }}
                            aria-label={`Agregar ${f.name}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
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
              <span className="text-left flex-1">
                <span className="flex items-center gap-1.5 text-[14px] font-semibold" style={{ color: 'var(--text-1)' }}>
                  <Flame className="w-4 h-4" style={{ color: 'var(--brand)' }} /> Pídelo ya frito
                </span>
                <span className="block text-[12px] mt-0.5 leading-snug" style={{ color: 'var(--text-3)' }}>
                  Te lo entregamos recién frito, listo para comer. +{format(FRITO_SURCHARGE.usd, FRITO_SURCHARGE.cop)} por bandeja.
                </span>
              </span>
              <span className="relative w-11 h-6 rounded-full flex-shrink-0 transition-colors" style={{ background: fritos ? 'var(--brand)' : 'var(--surface-3)' }}>
                <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: fritos ? '22px' : '2px' }} />
              </span>
            </button>
          )}
          {!purchasable ? (
            !product.available ? (
              <div className="text-center text-[13px] py-2" style={{ color: 'var(--text-3)' }}>Producto agotado</div>
            ) : (
              <div className="text-center text-[13px] py-2 inline-flex items-center justify-center gap-1.5 w-full" style={{ color: 'var(--text-3)' }}>
                <Lock className="w-4 h-4" /> No disponible en {CURRENCY_NAME[currency]}
              </div>
            )
          ) : hasFlavorUI ? (
            <button
              onClick={handleAddFlavors}
              disabled={totalFlavorQty === 0}
              className="btn btn-primary w-full disabled:opacity-50"
              style={{ minHeight: 48, fontSize: 15 }}
            >
              <Plus className="w-4 h-4" />
              {totalFlavorQty > 0 ? `Agregar ${totalFlavorQty} al carrito` : 'Elige al menos un sabor'}
            </button>
          ) : (
            <button
              onClick={handleAdd}
              className="btn btn-primary w-full"
              style={{ minHeight: 48, fontSize: 15 }}
            >
              <Plus className="w-4 h-4" />
              Agregar al carrito
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
