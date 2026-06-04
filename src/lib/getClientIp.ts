import type { NextRequest } from 'next/server';

/**
 * Best-effort client IP for per-IP rate limiting. Reads the first hop of
 * x-forwarded-for (set by Vercel/proxies); falls back to 'local' in dev.
 */
export function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}
