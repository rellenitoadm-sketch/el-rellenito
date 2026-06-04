/**
 * URL/id-safe slug from a display name: lowercased, accent-stripped,
 * non-alphanumerics collapsed to single hyphens, trimmed, capped at 40 chars.
 * Shared by the product store (mock) and the products API (Supabase).
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'producto';
}
