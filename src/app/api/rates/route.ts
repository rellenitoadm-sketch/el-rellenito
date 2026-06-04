import { NextResponse } from 'next/server';
import { getExchangeRates } from '@/lib/rates';

export const revalidate = 3600;

export async function GET() {
  const rates = await getExchangeRates();
  return NextResponse.json(rates);
}
