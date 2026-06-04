import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { mockStore } from '@/lib/mockStore';
import { isAuthorized } from '@/lib/adminAuth';

// Only these status values may be set, and only via this endpoint.
const VALID_STATUSES = ['pendiente', 'confirmado', 'en_camino', 'entregado', 'cancelado'] as const;
type Status = (typeof VALID_STATUSES)[number];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { status?: string };

  // Whitelist: only an allowed status value gets through (no mass-assignment).
  if (!body.status || !VALID_STATUSES.includes(body.status as Status)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
  }
  const patch = { status: body.status as Status };

  const db = supabaseAdmin ?? supabase;

  if (!db) {
    mockStore.updateStatus(id, patch.status);
    return NextResponse.json({ id, ...patch });
  }

  const { error } = await db
    .from('orders')
    .update(patch)
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
