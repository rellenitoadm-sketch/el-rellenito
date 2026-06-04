/**
 * In-memory product store — mock mode (dev / no Supabase yet).
 * Seeds from the static catalog in products.ts and supports full CRUD so the
 * admin panel works end-to-end before the DB is connected. When Supabase is
 * wired, the API routes use it instead and this is bypassed.
 *
 * Module-level array → shared across requests in the same process.
 */

import { products as seed, type Product } from './products';
import { slugify } from './slugify';

// Deep-ish clone so edits never mutate the original seed module.
let store: Product[] = seed.map(p => ({ ...p }));

export const productStore = {
  getAll(): Product[] {
    return store.map(p => ({ ...p }));
  },

  getById(id: string): Product | undefined {
    const p = store.find(x => x.id === id);
    return p ? { ...p } : undefined;
  },

  insert(input: Omit<Product, 'id'> & { id?: string }): Product {
    const base = input.id?.trim() || slugify(input.name);
    let id = base;
    let n = 2;
    while (store.some(p => p.id === id)) id = `${base}-${n++}`;
    const row: Product = { ...input, id };
    store.unshift(row);
    return { ...row };
  },

  update(id: string, patch: Partial<Product>): Product | null {
    const idx = store.findIndex(p => p.id === id);
    if (idx === -1) return null;
    const { id: _id, ...rest } = patch; // id is immutable — drop it from the patch
    store[idx] = { ...store[idx], ...rest };
    return { ...store[idx] };
  },

  remove(id: string): boolean {
    const before = store.length;
    store = store.filter(p => p.id !== id);
    return store.length < before;
  },
};
