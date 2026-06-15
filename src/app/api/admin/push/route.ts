import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/adminAuth';
import { saveSubscription, deleteSubscription, type BrowserSubscription } from '@/lib/push';

export const dynamic = 'force-dynamic';

/**
 * Registra la suscripción Web Push del dispositivo del equipo (admin/staff) para
 * recibir alertas de nuevos pedidos aunque la app esté cerrada.
 */
export async function POST(request: NextRequest) {
  const role = requireRole(request, 'admin', 'staff');
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null) as { subscription?: BrowserSubscription } | null;
  const sub = body?.subscription;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return NextResponse.json({ error: 'Suscripción inválida' }, { status: 400 });
  }

  const ok = await saveSubscription(sub, role, request.headers.get('user-agent'));
  if (!ok) return NextResponse.json({ error: 'No se pudo guardar' }, { status: 503 });
  return NextResponse.json({ ok: true });
}

/** Desuscribe el dispositivo (al apagar las alertas). */
export async function DELETE(request: NextRequest) {
  const role = requireRole(request, 'admin', 'staff');
  if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null) as { endpoint?: string } | null;
  if (!body?.endpoint) return NextResponse.json({ error: 'Falta endpoint' }, { status: 400 });

  await deleteSubscription(body.endpoint);
  return NextResponse.json({ ok: true });
}
