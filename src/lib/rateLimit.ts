/**
 * Best-effort in-memory rate limiter (per key). Zero external resources.
 *
 * Note: on serverless (Vercel) each instance has its own memory, so this is a
 * soft deterrent rather than a hard global limit — sufficient against casual
 * brute force when paired with a 6-digit PIN (1,000,000 combinations).
 */

type Bucket = { count: number; windowStart: number; blockedUntil: number };

const buckets = new Map<string, Bucket>();

const WINDOW_MS = 60_000;   // rolling window
const MAX_ATTEMPTS = 5;     // failures allowed per window
const BLOCK_MS = 60_000;    // lockout duration once exceeded

export function checkRateLimit(key: string): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (b && b.blockedUntil > now) {
    return { allowed: false, retryAfter: Math.ceil((b.blockedUntil - now) / 1000) };
  }
  return { allowed: true, retryAfter: 0 };
}

export function recordFailure(key: string): void {
  const now = Date.now();
  const b = buckets.get(key) ?? { count: 0, windowStart: now, blockedUntil: 0 };
  if (now - b.windowStart > WINDOW_MS) {
    b.count = 0;
    b.windowStart = now;
  }
  b.count += 1;
  if (b.count >= MAX_ATTEMPTS) {
    b.blockedUntil = now + BLOCK_MS;
    b.count = 0;
    b.windowStart = now;
  }
  buckets.set(key, b);
}

export function recordSuccess(key: string): void {
  buckets.delete(key);
}
