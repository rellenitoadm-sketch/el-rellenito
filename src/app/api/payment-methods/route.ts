import { NextResponse } from 'next/server';
import { listPaymentMethods } from '@/lib/paymentMethods';

export const dynamic = 'force-dynamic';

/** Lectura pública: métodos de pago activos, ordenados (con fallback estático). */
export async function GET() {
  return NextResponse.json(await listPaymentMethods(false));
}
