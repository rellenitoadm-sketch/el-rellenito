/**
 * Webhook saliente para automatizaciones (n8n, Make, Zapier…).
 *
 * Deja la integración LISTA: si defines `N8N_WEBHOOK_URL`, cada evento de pedido
 * (creado / cambio de estado) se envía como POST JSON a esa URL. Desde n8n puedes
 * disparar mensajes de WhatsApp ("pedido en camino", "pedido cancelado", etc.).
 * Si la URL no está definida, no hace nada (no rompe el flujo del pedido).
 *
 * Payload:
 *   { event, order: {...}, sent_at }
 *
 * Seguridad opcional: si defines `N8N_WEBHOOK_SECRET`, se manda en el header
 * `x-webhook-secret` para que n8n valide el origen.
 */

export type OrderEvent = 'order.created' | 'order.status_changed';

export interface OrderEventPayload {
  id?: string;
  customer_name?: string;
  customer_whatsapp?: string;
  status?: string;
  total_usd?: number;
  total_cop?: number | null;
  currency_shown?: string;
  is_wholesale?: boolean;
  delivery_type?: string;
  delivery_zone?: string | null;
  delivery_address?: string | null;
  payment_method?: string;
  scheduled_date?: string | null;
  scheduled_time?: string | null;
  items?: unknown;
  [key: string]: unknown;
}

/** Dispara un evento de pedido al webhook configurado. Best-effort, nunca lanza. */
export async function fireOrderEvent(event: OrderEvent, order: OrderEventPayload): Promise<void> {
  const url = process.env.N8N_WEBHOOK_URL;
  if (!url) return; // integración no configurada → no-op

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (secret) headers['x-webhook-secret'] = secret;

  try {
    await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ event, order, sent_at: new Date().toISOString() }),
    });
  } catch (err) {
    console.warn('n8n webhook:', err);
  }
}
