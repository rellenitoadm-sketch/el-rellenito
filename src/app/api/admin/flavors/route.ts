import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRole } from '@/lib/adminAuth';

/** Lista de sabores globales — SOLO admin. */
export async function GET(request: NextRequest) {
  if (!requireRole(request, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseAdmin) return NextResponse.json([]);
  const { data, error } = await supabaseAdmin
    .from('flavors')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/** Crear un sabor — SOLO admin. */
export async function POST(request: NextRequest) {
  if (!requireRole(request, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({})) as { name?: string; sort_order?: number };
  const name = (body.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });

  const { data, error } = await supabaseAdmin
    .from('flavors')
    .insert([{ name, sort_order: body.sort_order ?? 0 }])
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
