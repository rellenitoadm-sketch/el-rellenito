/**
 * Staff access — server-only, PIN-based with roles. No typical login form.
 *
 * Two PINs live in env vars (never NEXT_PUBLIC_*, never in the DB → zero extra
 * resources): ADMIN_PIN (full access) and STAFF_PIN (orders + products).
 * The session cookie stores a SHA-256 token derived from "role:pin", never the
 * PIN itself. Role is recovered by matching the token against each role's token.
 */

import { createHash, timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';

export const COOKIE_NAME = 'staff_session';
/** Non-sensitive hint cookie (readable by JS) — only toggles the quick-access
 *  shortcut UI on registered devices. Grants NO access on its own. */
export const HINT_COOKIE = 'staff_hint';

export type StaffRole = 'admin' | 'staff';

/** All roles, highest privilege first. Single source for role iteration. */
export const ROLES: StaffRole[] = ['admin', 'staff'];

/** PINs from env, with dev-only fallbacks so it works out of the box locally. */
function getPins(): Record<StaffRole, string | null> {
  const isDev = process.env.NODE_ENV !== 'production';
  return {
    admin: process.env.ADMIN_PIN ?? (isDev ? '482079' : null),
    staff: process.env.STAFF_PIN ?? (isDev ? '153846' : null),
  };
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Session token stored in the cookie for a given role (or null if unset). */
export function tokenForRole(role: StaffRole): string | null {
  const pin = getPins()[role];
  if (!pin) return null;
  return sha256(`${role}:${pin}`);
}

/** Returns the role a submitted PIN unlocks, or null if it matches none. */
export function roleForPin(pin: string): StaffRole | null {
  const pins = getPins();
  for (const role of ROLES) {
    const p = pins[role];
    if (p && safeEqual(pin, p)) return role;
  }
  return null;
}

/** Recovers the role carried by a valid session cookie, or null. */
export function roleFromRequest(request: NextRequest): StaffRole | null {
  const session = request.cookies.get(COOKIE_NAME)?.value;
  if (!session) return null;
  for (const role of ROLES) {
    const token = tokenForRole(role);
    if (token && safeEqual(session, token)) return role;
  }
  return null;
}

/** True when the request carries any valid staff session. */
export function isAuthorized(request: NextRequest): boolean {
  return roleFromRequest(request) !== null;
}

/**
 * Gate a request to specific roles. Returns the validated role, or null if the
 * caller lacks a session / isn't in `allowed`. Single enforcement point so each
 * route states its required role at the call site (no scattered === 'admin').
 */
export function requireRole(request: NextRequest, ...allowed: StaffRole[]): StaffRole | null {
  const role = roleFromRequest(request);
  if (!role) return null;
  if (allowed.length > 0 && !allowed.includes(role)) return null;
  return role;
}
