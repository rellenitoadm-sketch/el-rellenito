'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { products as staticProducts, type Product } from '@/lib/products';

interface ProductsContextValue {
  /** Live catalog — seeded from the static list, refreshed from the DB. */
  products: Product[];
  loading: boolean;
}

const ProductsContext = createContext<ProductsContextValue | null>(null);

/**
 * Loads the catalog from /api/products (Supabase-backed) so admin edits show up
 * on the storefront. Seeds synchronously from the bundled static list so the
 * page paints instantly and still works if the request fails (offline / no DB).
 */
export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>(staticProducts);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/products')
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((data: Product[]) => {
        if (!cancelled && Array.isArray(data) && data.length > 0) setProducts(data);
      })
      .catch(() => { /* keep static fallback */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <ProductsContext.Provider value={{ products, loading }}>
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts(): ProductsContextValue {
  const ctx = useContext(ProductsContext);
  // Fallback to static list if used outside the provider (defensive).
  if (!ctx) return { products: staticProducts, loading: false };
  return ctx;
}
