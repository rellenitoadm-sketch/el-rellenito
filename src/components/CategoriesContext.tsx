'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import { categories as staticCats, categoryLabels, categoryEmoji } from '@/lib/products';

export interface CategoryMeta {
  key: string;
  label: string;
  emoji: string;
  sort_order: number;
  active: boolean;
}

function staticList(): CategoryMeta[] {
  return staticCats.map((key, i) => ({
    key,
    label: categoryLabels[key] ?? key,
    emoji: categoryEmoji[key] ?? '🍽️',
    sort_order: i + 1,
    active: true,
  }));
}

interface CategoriesValue {
  /** Categorías activas, ordenadas (meta completa). */
  cats: CategoryMeta[];
  /** Sólo las keys, en orden (reemplaza al antiguo `categories`). */
  order: string[];
  /** Label de una key, con fallback al estático y a la propia key. */
  labelOf: (key: string) => string;
  /** Emoji de una key, con fallback. */
  emojiOf: (key: string) => string;
  loading: boolean;
  reload: () => Promise<void>;
}

const CategoriesContext = createContext<CategoriesValue | null>(null);

/**
 * Carga las categorías desde /api/categories (gestionables en el panel admin).
 * Siembra desde la lista estática para pintar al instante y seguir funcionando
 * si la API falla.
 */
export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [cats, setCats] = useState<CategoryMeta[]>(staticList);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json() as CategoryMeta[];
        if (Array.isArray(data) && data.length > 0) setCats(data);
      }
    } catch { /* mantener lo que haya */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const value = useMemo<CategoriesValue>(() => {
    const map = new Map(cats.map(c => [c.key, c]));
    return {
      cats,
      order: cats.map(c => c.key),
      labelOf: (key) => map.get(key)?.label ?? categoryLabels[key] ?? key,
      emojiOf: (key) => map.get(key)?.emoji ?? categoryEmoji[key] ?? '🍽️',
      loading,
      reload,
    };
  }, [cats, loading, reload]);

  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>;
}

export function useCategories(): CategoriesValue {
  const ctx = useContext(CategoriesContext);
  if (ctx) return ctx;
  // Fallback defensivo (fuera del provider): lista estática.
  const s = staticList();
  const map = new Map(s.map(c => [c.key, c]));
  return {
    cats: s,
    order: s.map(c => c.key),
    labelOf: (key) => map.get(key)?.label ?? categoryLabels[key] ?? key,
    emojiOf: (key) => map.get(key)?.emoji ?? categoryEmoji[key] ?? '🍽️',
    loading: false,
    reload: async () => {},
  };
}
