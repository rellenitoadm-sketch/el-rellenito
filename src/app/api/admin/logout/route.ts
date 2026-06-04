import { NextResponse } from 'next/server';
import { COOKIE_NAME, HINT_COOKIE } from '@/lib/adminAuth';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(COOKIE_NAME);
  res.cookies.delete(HINT_COOKIE);
  return res;
}
