import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRole } from '@/lib/adminAuth';
import { caracasDate } from '@/lib/wholesaleOrders';
import { loadOrder, recomputePaidShare } from '@/lib/wholesaleOrders.server';

/**
 * Deshacer una marca del cierre (un cobro mal anotado). El equipo solo puede
 * deshacer las de hoy; el admin, cualquiera. Así nadie borra cobros viejos que
 * ya se cuadraron.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> },
) {
  const role = requireRole(request, 'admin', 'staff');
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!supabaseAdmin) return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });

  const { id, paymentId } = await params;
  const { data: payment } = await supabaseAdmin
    .from('wholesale_payments')
    .select('id, order_id, collected_on')
    .eq('id', paymentId)
    .eq('order_id', id)
    .maybeSingle();
  if (!payment) return NextResponse.json({ error: 'Cobro no encontrado' }, { status: 404 });
  if (role !== 'admin' && payment.collected_on !== caracasDate()) {
    return NextResponse.json({ error: 'Solo el administrador puede deshacer cobros de otros días.' }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from('wholesale_payments').delete().eq('id', paymentId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await recomputePaidShare(supabaseAdmin, id);
  return NextResponse.json(await loadOrder(supabaseAdmin, id));
}
