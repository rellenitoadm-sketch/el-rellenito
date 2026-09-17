import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRole } from '@/lib/adminAuth';
import {
  COP_TOLERANCE,
  amountFor,
  caracasDate,
  remainingShare,
  shareOf,
  type PaymentCurrency,
  type PaymentOutcome,
} from '@/lib/wholesaleOrders';
import { cleanText, getStoredRates, loadOrder, recomputePaidShare } from '@/lib/wholesaleOrders.server';

const CURRENCIES: PaymentCurrency[] = ['COP', 'VES', 'USD'];
const OUTCOMES: PaymentOutcome[] = ['pagado', 'abono', 'no_pago'];
const UUID = /^[0-9a-f-]{36}$/i;
/** La tasa en Bs puede diferir de la guardada (a las 8pm el BCV ya publicó la de mañana), pero no tanto. */
const RATE_DRIFT = 0.2;

/**
 * Marca del cierre del día sobre un pedido. Equipo o admin.
 * Body: `{ outcome, currency?, amount?, rate_ves?, driver_id?, driver_name?, note? }`.
 * - `pagado`: cubre todo el saldo; el monto lo calcula el servidor en la moneda elegida.
 * - `abono`: el monto cubre parte del saldo. Si llega a cubrirlo (±100 pesos) se guarda como pagado.
 * - `no_pago`: deja constancia de que se revisó y no pagó (una vez por día).
 * La fecha del cobro es la de hoy en Venezuela, la pone el servidor.
 */
export async function POST(
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
  const outcome = body.outcome as PaymentOutcome;
  if (!OUTCOMES.includes(outcome)) return NextResponse.json({ error: 'Resultado inválido.' }, { status: 400 });

  const order = await loadOrder(db, id);
  if (!order) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
  if (order.status === 'cancelado') return NextResponse.json({ error: 'Este pedido está cancelado.' }, { status: 409 });

  const today = caracasDate();
  const remaining = remainingShare(order.paid_share);
  const settled = remaining * order.total_cop <= COP_TOLERANCE;
  const base = {
    order_id: id,
    collected_on: today,
    outcome,
    driver_id: typeof body.driver_id === 'string' && UUID.test(body.driver_id) ? body.driver_id : null,
    driver_name: cleanText(body.driver_name, 80),
    note: cleanText(body.note),
  };

  let row: typeof base & { currency: PaymentCurrency | null; amount: number; rate_ves: number | null; share: number };

  if (outcome === 'no_pago') {
    if (settled) return NextResponse.json({ error: 'Este pedido ya está pagado.' }, { status: 409 });
    if (order.payments.some(p => p.outcome === 'no_pago' && p.collected_on === today)) {
      return NextResponse.json({ error: 'Ya quedó marcado como que no pagó hoy.' }, { status: 409 });
    }
    row = { ...base, currency: null, amount: 0, rate_ves: null, share: 0 };
  } else {
    if (settled) return NextResponse.json({ error: 'Este pedido ya está pagado.' }, { status: 409 });
    const currency = body.currency as PaymentCurrency;
    if (!CURRENCIES.includes(currency)) return NextResponse.json({ error: 'Elige la moneda.' }, { status: 400 });

    let rateVes: number | null = null;
    if (currency === 'VES') {
      rateVes = Number(body.rate_ves);
      const stored = (await getStoredRates(db))?.bs_per_usd;
      const drifted = stored ? Math.abs(rateVes - stored) / stored > RATE_DRIFT : false;
      if (!Number.isFinite(rateVes) || rateVes < 100 || drifted) {
        return NextResponse.json({ error: 'Revisa la tasa en bolívares.' }, { status: 400 });
      }
    }

    if (outcome === 'pagado') {
      row = { ...base, currency, rate_ves: rateVes, share: remaining, amount: amountFor(remaining, currency, order, rateVes) };
    } else {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'Escribe el monto abonado.' }, { status: 400 });
      const share = shareOf(amount, currency, order, rateVes);
      const leftoverCop = (remaining - share) * order.total_cop;
      if (leftoverCop < -COP_TOLERANCE) {
        const max = amountFor(remaining, currency, order, rateVes);
        return NextResponse.json({ error: `El monto supera el saldo. Saldo: ${max.toLocaleString('es-CO')} ${currency}.` }, { status: 400 });
      }
      // Si el abono cubre el saldo (±100 pesos), se registra como pago completo.
      row = leftoverCop <= COP_TOLERANCE
        ? { ...base, outcome: 'pagado', currency, amount, rate_ves: rateVes, share: remaining }
        : { ...base, currency, amount, rate_ves: rateVes, share };
    }
  }

  const { data: inserted, error } = await db.from('wholesale_payments').insert(row).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Dos cobros guardados a la vez desde teléfonos distintos pueden pasarse del total.
  const sum = await recomputePaidShare(db, id);
  if (sum > 1 + 1e-6) {
    await db.from('wholesale_payments').delete().eq('id', inserted.id);
    await recomputePaidShare(db, id);
    return NextResponse.json({ error: 'Otro cobro se registró al mismo tiempo. Recarga la lista.' }, { status: 409 });
  }

  // Si cobraron, el pedido se entregó aunque nadie lo haya marcado.
  if (row.share > 0 && order.status === 'registrado') {
    await db
      .from('wholesale_orders')
      .update({ status: 'entregado', delivered_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'registrado');
  }

  return NextResponse.json(await loadOrder(db, id), { status: 201 });
}
