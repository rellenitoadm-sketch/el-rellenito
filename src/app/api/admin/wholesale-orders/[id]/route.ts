import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRole } from '@/lib/adminAuth';
import { MAX_AHEAD_DAYS, addDays, caracasDate, isYmd } from '@/lib/wholesaleOrders';
import { parseWholesaleItems } from '@/lib/inventory';
import { clearOrderMovements, registerSaleSafely, releaseSale } from '@/lib/inventory.server';
import {
  OrderInputError,
  cleanText,
  getStoredRates,
  loadOrder,
  priceItems,
} from '@/lib/wholesaleOrders.server';
import type { Database, Json } from '@/lib/database.types';

type OrderUpdate = Database['public']['Tables']['wholesale_orders']['Update'];

/**
 * Cambios sobre un pedido mayorista. Equipo o admin. `action`:
 * - `deliver` / `undeliver`: marcar o desmarcar entregado (desmarcar solo sin cobros).
 * - `cancel`: solo sin cobros.
 * - `release`: quitar el domiciliario asignado (solo sin entregar).
 * - `edit`: productos, notas y fecha (solo sin entregar y sin cobros; la fecha solo sin asignar).
 * Cada update exige el estado esperado, para no pisar un cambio hecho a la vez desde otro teléfono.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!requireRole(request, 'admin', 'staff')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseAdmin) return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
  const db = supabaseAdmin;

  const { id } = await params;
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const order = await loadOrder(db, id);
  if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
  const hasPayments = order.payments.length > 0;

  const conflict = (error: string) => NextResponse.json({ error }, { status: 409 });
  /** `afterOk` solo corre si el pedido se actualizó de verdad (inventario). */
  const apply = async (patch: OrderUpdate, expectedStatus: string[], afterOk?: () => Promise<void>) => {
    const { data, error } = await db
      .from('wholesale_orders')
      .update(patch)
      .eq('id', id)
      .in('status', expectedStatus)
      .select('id');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data || data.length === 0) return conflict('El pedido cambió mientras tanto. Recarga la lista.');
    if (afterOk) {
      try {
        await afterOk();
      } catch (err) {
        // El inventario nunca tumba el cambio del pedido.
        console.warn('Inventario (pedido mayorista):', err instanceof Error ? err.message : err);
      }
    }
    return NextResponse.json(await loadOrder(db, id));
  };

  switch (body.action) {
    case 'deliver': {
      if (order.status === 'entregado') return NextResponse.json(order);
      if (order.status !== 'registrado') return conflict('Este pedido está cancelado.');
      // Entregar un pedido que nadie había tomado deja constancia de quién lo llevó.
      const driverName = cleanText(body.driver_name, 80);
      const takes = !order.driver_name && driverName
        ? {
          driver_name: driverName,
          driver_id: typeof body.driver_id === 'string' ? body.driver_id : null,
          assigned_at: new Date().toISOString(),
        }
        : {};
      return apply({ status: 'entregado', delivered_at: new Date().toISOString(), ...takes }, ['registrado']);
    }

    case 'undeliver':
      if (order.status !== 'entregado') return conflict('Este pedido no está marcado como entregado.');
      if (hasPayments) return conflict('Ya tiene cobros registrados. Deshaz los cobros primero.');
      return apply({ status: 'registrado', delivered_at: null }, ['entregado']);

    case 'cancel':
      if (order.status === 'cancelado') return NextResponse.json(order);
      if (hasPayments) return conflict('No se puede cancelar un pedido con cobros registrados.');
      // Lo que apartaba este pedido vuelve al inventario de su día de entrega.
      return apply({ status: 'cancelado' }, ['registrado', 'entregado'], () => releaseSale(db, {
        day: order.delivery_date,
        lines: parseWholesaleItems(order.items),
        wholesaleOrderId: id,
        actor: cleanText(body.driver_name, 80),
      }));

    case 'release':
      if (order.status !== 'registrado') return conflict('Solo se puede soltar un pedido sin entregar.');
      return apply({ driver_id: null, driver_name: null, assigned_at: null }, ['registrado']);

    case 'edit': {
      if (order.status !== 'registrado') return conflict('Solo se editan pedidos sin entregar.');
      if (hasPayments) return conflict('Ya tiene cobros registrados; no se puede editar.');
      const patch: OrderUpdate = {};
      if (body.delivery_date !== undefined && body.delivery_date !== order.delivery_date) {
        if (!isYmd(body.delivery_date)) return NextResponse.json({ error: 'Fecha de entrega inválida.' }, { status: 400 });
        const today = caracasDate();
        if (body.delivery_date < today) {
          return NextResponse.json({ error: 'Esa fecha ya pasó. Elige hoy o un día siguiente.' }, { status: 400 });
        }
        if (body.delivery_date > addDays(today, MAX_AHEAD_DAYS)) {
          return NextResponse.json({ error: 'Esa fecha está demasiado lejos. Revísala.' }, { status: 400 });
        }
        if (order.driver_name) return conflict(`Lo lleva ${order.driver_name}; suéltalo antes de cambiar la fecha.`);
        patch.delivery_date = body.delivery_date;
      }
      if (body.notes !== undefined) patch.notes = cleanText(body.notes);
      if (body.items !== undefined) {
        try {
          const rates = await getStoredRates(db);
          const priced = await priceItems(db, body.items, rates?.cop_per_usd ?? null);
          patch.items = priced.items as unknown as Json;
          patch.total_usd = priced.total_usd;
          patch.total_cop = priced.total_cop;
        } catch (e) {
          if (e instanceof OrderInputError) return NextResponse.json({ error: e.message }, { status: 400 });
          return NextResponse.json({ error: 'No se pudo recalcular el pedido.' }, { status: 500 });
        }
      }
      // Cambiaron los productos o la fecha: se rehacen los movimientos de este
      // pedido en vez de intentar calcular diferencias línea por línea.
      const rehacerInventario = patch.items !== undefined || patch.delivery_date !== undefined
        ? async () => {
          await clearOrderMovements(db, { wholesaleOrderId: id });
          const fresco = await loadOrder(db, id);
          if (!fresco || fresco.status === 'cancelado') return;
          await registerSaleSafely(db, {
            day: fresco.delivery_date,
            lines: parseWholesaleItems(fresco.items),
            wholesaleOrderId: id,
            actor: cleanText(body.actor, 80),
          });
        }
        : undefined;
      return apply(patch, ['registrado'], rehacerInventario);
    }

    default:
      return NextResponse.json({ error: 'Acción inválida' }, { status: 400 });
  }
}
