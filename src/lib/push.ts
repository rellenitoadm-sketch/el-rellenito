/**
 * Web Push (notificaciones al celular del equipo, incluso con la app cerrada).
 *
 * Las suscripciones del navegador se guardan en Supabase (`push_subscriptions`)
 * y se envían con VAPID vía `web-push`. Cliente Supabase sin genérico tipado a
 * propósito: la tabla no está en `database.types.ts` y no queremos regenerarlo.
 */
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:admin@elrellenito.com';

let configured = false;
/** Configura VAPID una sola vez. Devuelve false si faltan las claves. */
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  configured = true;
  return true;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const db = url && serviceKey
  ? createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

/** Forma de la suscripción tal como la entrega el navegador. */
export interface BrowserSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

interface SubRow { endpoint: string; p256dh: string; auth: string }

/** Guarda (o actualiza) una suscripción del equipo. */
export async function saveSubscription(
  sub: BrowserSubscription,
  role: string | null,
  userAgent: string | null,
): Promise<boolean> {
  if (!db) return false;
  const { error } = await db.from('push_subscriptions').upsert(
    {
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      role,
      user_agent: userAgent,
      last_seen: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  );
  return !error;
}

/** Elimina una suscripción (al desuscribirse o si el endpoint murió). */
export async function deleteSubscription(endpoint: string): Promise<void> {
  if (!db) return;
  await db.from('push_subscriptions').delete().eq('endpoint', endpoint);
}

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  count?: number;
}

/**
 * Envía una notificación a TODAS las suscripciones guardadas. Las suscripciones
 * muertas (404/410) se eliminan automáticamente. Best-effort: nunca lanza.
 */
export async function sendPushToAll(payload: PushPayload): Promise<{ sent: number; removed: number }> {
  if (!db || !ensureConfigured()) return { sent: 0, removed: 0 };
  const { data, error } = await db.from('push_subscriptions').select('endpoint, p256dh, auth');
  if (error || !data) return { sent: 0, removed: 0 };

  const rows = data as SubRow[];
  const json = JSON.stringify(payload);
  let sent = 0;
  let removed = 0;

  await Promise.allSettled(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          json,
          { TTL: 120, headers: { Urgency: 'high' } },
        );
        sent++;
      } catch (err) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await deleteSubscription(row.endpoint);
          removed++;
        }
      }
    }),
  );

  return { sent, removed };
}

/** ¿Está configurado el push? (claves VAPID presentes). */
export function pushConfigured(): boolean {
  return ensureConfigured();
}
