import { NextResponse } from 'next/server';
import { listCategories } from '@/lib/categories';

export const dynamic = 'force-dynamic';

/** Lectura pública: categorías activas, ordenadas (con fallback estático). */
export async function GET() {
  const cats = await listCategories(false);
  return NextResponse.json(cats);
}
