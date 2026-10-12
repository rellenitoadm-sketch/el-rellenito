import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRole } from '@/lib/adminAuth';
import { caracasDate } from '@/lib/wholesaleOrders';
import { dayStock, isManualKind } from '@/lib/inventory.server';

/**
 * Deshace un movimiento escrito a mano (producción, merma o ajuste) del día en
 * curso. Las ventas no se borran desde aquí: esas se corrigen cancelando el
 * pedido, que es lo que devuelve las unidades y deja constancia.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!requireRole(request, 'admin', 'staff')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseAdmin) return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
  const db = supabaseAdmin;

  const { id } = await params;
  const { data: mov } = await db
    .from('stock_movements')
    .select('id, day, kind')
    .eq('id', id)
    .maybeSingle();
  if (!mov) return NextResponse.json({ error: 'Movimiento no encontrado' }, { status: 404 });

  if (!isManualKind(mov.kind)) {
    return NextResponse.json(
      { error: 'Eso vino de un pedido. Para devolver las unidades, cancela el pedido.' },
      { status: 409 },
    );
  }
  if (mov.day !== caracasDate()) {
    return NextResponse.json(
      { error: 'Solo se deshace lo de hoy. Para corregir otro día, registra un ajuste.' },
      { status: 403 },
    );
  }

  const { error } = await db.from('stock_movements').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const fresco = await dayStock(db, mov.day);
  return NextResponse.json({ date: mov.day, rows: fresco.rows, movements: fresco.movements });
}
