'use client';

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import type { Product, ProductCategory } from '@/lib/products';
import { unitUsd } from '@/lib/rates';

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
  addItem: (product: Product) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
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

  const addItem = useCallback((product: Product) => {
    setItems(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        return prev.map(i =>
          i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price_usd: product.price_usd,
          price_cop: product.price_cop ?? null,
          wholesale_price_usd: product.wholesale_price_usd,
          wholesale_price_cop: product.wholesale_price_cop ?? null,
          quantity: 1,
          image_url: product.image_url,
          category: product.category,
        },
      ];
    });
    addCountRef.current += 1;
    setLastAdded({ id: product.id, name: product.name, key: addCountRef.current });
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

  const clearCart = useCallback(() => setItems([]), []);
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  // Total efectivo: aplica la tarifa al mayor por ítem cuando cantidad >= 10.
  const totalUsd = items.reduce((sum, i) => sum + unitUsd(i, i.quantity) * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, isOpen, addItem, removeItem, updateQty, clearCart, openCart, closeCart, totalUsd, itemCount, lastAdded }}
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
