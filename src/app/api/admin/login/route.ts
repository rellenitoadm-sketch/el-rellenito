import { NextRequest, NextResponse } from 'next/server';
import { COOKIE_NAME, HINT_COOKIE, roleForPin, tokenForRole } from '@/lib/adminAuth';
import { checkRateLimit, recordFailure, recordSuccess } from '@/lib/rateLimit';
import { getClientIp } from '@/lib/getClientIp';

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Espera un momento.', retryAfter: rl.retryAfter },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => ({})) as { pin?: string };
  const pin = (body.pin ?? '').trim();

  // Small constant delay to slow brute force.
  await new Promise(r => setTimeout(r, 250));

  const role = pin ? roleForPin(pin) : null;
  if (!role) {
    recordFailure(ip);
    return NextResponse.json({ error: 'Código incorrecto' }, { status: 401 });
  }

  const token = tokenForRole(role);
  if (!token) {
    return NextResponse.json({ error: 'Acceso no configurado' }, { status: 503 });
  }

  recordSuccess(ip);
  const secure = process.env.NODE_ENV === 'production';
  const res = NextResponse.json({ ok: true, role });

  // Session cookie (httpOnly) — grants access. Long-lived: it's the worker's own device.
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true, sameSite: 'lax', path: '/', secure, maxAge: 60 * 60 * 24 * 30,
  });
  // Hint cookie (readable by JS) — only toggles the quick-access shortcut. Grants nothing.
  res.cookies.set(HINT_COOKIE, '1', {
    httpOnly: false, sameSite: 'lax', path: '/', secure, maxAge: 60 * 60 * 24 * 90,
  });
  return res;
}
