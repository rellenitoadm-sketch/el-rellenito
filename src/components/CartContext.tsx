'use client';

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import type { Product, ProductCategory } from '@/lib/products';
import { unitUsd } from '@/lib/rates';
import { fritoUnitUsd } from '@/lib/fritos';

export interface CartItem {
  id: string;
  name: string;
  price_usd: number;
  /** Precio al detal en COP fijado por el cliente (null = derivar de USD × tasa). */
  price_cop?: number | null;
  /** Precio al mayor en USD (= detal si no hay descuento al mayor). */
  wholesale_price_usd: number;
  /** Precio al mayor en COP fijado por el cliente (null = derivar de USD × tasa). */
  wholesale_price_cop?: number | null;
  /** Umbral mayorista propio del producto (null = usar el default global). */
  limite_unidades_mayor?: number | null;
  /** El producto admite servicio de fritos (recargo por bandeja). */
  cobra_frito?: boolean | null;
  /** El cliente eligió fritos para esta línea. */
  fritos?: boolean;
  /** Sabor elegido (si el producto se vende por sabores). */
  flavorId?: string | null;
  flavorName?: string | null;
  quantity: number;
  image_url: string | null;
  category: ProductCategory;
}

export interface LastAdded {
  id: string;
  name: string;
  key: number;
}

interface CartContextValue {
  items: CartItem[];
  isOpen: boolean;
  addItem: (product: Product, opts?: { fritos?: boolean; flavor?: { id: string; name: string }; quantity?: number }) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  setItemFritos: (id: string, fritos: boolean) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  totalUsd: number;
  itemCount: number;
  lastAdded: LastAdded | null;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [lastAdded, setLastAdded] = useState<LastAdded | null>(null);
  const addCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addItem = useCallback((product: Product, opts?: { fritos?: boolean; flavor?: { id: string; name: string }; quantity?: number }) => {
    const qty = Math.max(1, Math.round(opts?.quantity ?? 1));
    // Cada (producto + sabor) es una línea propia del carrito.
    const lineId = opts?.flavor ? `${product.id}::${opts.flavor.id}` : product.id;
    const displayName = opts?.flavor ? `${product.name} · ${opts.flavor.name}` : product.name;
    setItems(prev => {
      const existing = prev.find(i => i.id === lineId);
      if (existing) {
        return prev.map(i =>
          i.id === lineId
            ? { ...i, quantity: i.quantity + qty, ...(opts?.fritos !== undefined ? { fritos: opts.fritos } : {}) }
            : i
        );
      }
      return [
        ...prev,
        {
          id: lineId,
          name: displayName,
          price_usd: product.price_usd,
          price_cop: product.price_cop ?? null,
          wholesale_price_usd: product.wholesale_price_usd,
          wholesale_price_cop: product.wholesale_price_cop ?? null,
          limite_unidades_mayor: product.limite_unidades_mayor ?? null,
          cobra_frito: product.cobra_frito ?? null,
          fritos: opts?.fritos ?? false,
          flavorId: opts?.flavor?.id ?? null,
          flavorName: opts?.flavor?.name ?? null,
          quantity: qty,
          image_url: product.image_url,
          category: product.category,
        },
      ];
    });
    addCountRef.current += 1;
    setLastAdded({ id: lineId, name: displayName, key: addCountRef.current });
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setLastAdded(null), 1500);
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const updateQty = useCallback((id: string, qty: number) => {
    if (qty <= 0) {
      setItems(prev => prev.filter(i => i.id !== id));
    } else {
      setItems(prev =>
        prev.map(i => (i.id === id ? { ...i, quantity: qty } : i))
      );
    }
  }, []);

  const setItemFritos = useCallback((id: string, fritos: boolean) => {
    setItems(prev => prev.map(i => (i.id === id ? { ...i, fritos } : i)));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  // Total efectivo: tarifa al mayor por ítem según su umbral + recargo de fritos.
  const totalUsd = items.reduce((sum, i) => sum + (unitUsd(i, i.quantity) + fritoUnitUsd(i)) * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, isOpen, addItem, removeItem, updateQty, setItemFritos, clearCart, openCart, closeCart, totalUsd, itemCount, lastAdded }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be inside CartProvider');
  return ctx;
}
