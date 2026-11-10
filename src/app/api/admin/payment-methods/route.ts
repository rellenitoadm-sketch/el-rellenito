import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/adminAuth';
import { createPaymentMethod, listPaymentMethods, updatePaymentMethod, deletePaymentMethod } from '@/lib/paymentMethods';

export const dynamic = 'force-dynamic';

/**
 * Datos de cuentas bancarias/pago: SOLO admin (igual que `notes` de mayoristas),
 * para no exponer ni dejar editar cuentas al equipo.
 */
export async function GET(request: NextRequest) {
  if (!requireRole(request, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json(await listPaymentMethods(true));
}

/** Crear método de pago. */
export async function POST(request: NextRequest) {
  if (!requireRole(request, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as { label?: string; icon?: string } | null;
  if (!body?.label?.trim()) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });
  const result = await createPaymentMethod(body.label, body.icon ?? 'Wallet');
  if ('error' in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result, { status: 201 });
}

/** Editar método de pago (label / icono / detalles / nota / orden / activo). */
export async function PATCH(request: NextRequest) {
  if (!requireRole(request, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as
    | { id?: string; label?: string; icon?: string; details?: Record<string, string>; note?: string | null; sort_order?: number; active?: boolean }
    | null;
  if (!body?.id) return NextResponse.json({ error: 'Falta el método de pago' }, { status: 400 });
  const result = await updatePaymentMethod(body.id, body);
  if ('error' in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}

/** Eliminar método de pago. */
export async function DELETE(request: NextRequest) {
  if (!requireRole(request, 'admin')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => null) as { id?: string } | null;
  if (!body?.id) return NextResponse.json({ error: 'Falta el método de pago' }, { status: 400 });
  const result = await deletePaymentMethod(body.id);
  if ('error' in result) return NextResponse.json(result, { status: 400 });
  return NextResponse.json(result);
}
