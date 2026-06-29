import type { CartItem } from '@/components/CartContext';
import type { PaymentMethodId } from './payments';
import { paymentMethods } from './payments';
import type { ExchangeRates } from './rates';
import { formatPrice } from './rates';

export interface OrderData {
  customerName: string;
  customerWhatsapp: string;
  deliveryType: 'delivery' | 'retiro';
  deliveryZoneName: string;
  deliveryCostCop: number;
  deliveryAddress: string;
  notes: string;
  items: CartItem[];
  totalUsd: number;
  currency: 'USD' | 'COP' | 'BS';
  paymentMethod: PaymentMethodId;
  rates: ExchangeRates;
}

const BUSINESS_WHATSAPP = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? '584247207067';

export function buildWhatsAppMessage(order: OrderData): string {
  const method = paymentMethods.find(p => p.id === order.paymentMethod);
  const deliveryCostUsd = order.deliveryCostCop / order.rates.cop_per_usd;
  const grandTotalUsd = order.totalUsd + deliveryCostUsd;

  const lines: string[] = [
    '🛍️ *NUEVO PEDIDO — El Rellenito*',
    '─────────────────────',
    `👤 *Cliente:* ${order.customerName}`,
    `📱 *WhatsApp:* ${order.customerWhatsapp}`,
    '',
    '📦 *PRODUCTOS:*',
    ...order.items.map(
      item =>
        `• ${item.quantity}x ${item.name} — ${formatPrice(item.price_usd * item.quantity, order.rates, order.currency)}`
    ),
    '',
    `🧾 *Subtotal:* ${formatPrice(order.totalUsd, order.rates, order.currency)}`,
  ];

  if (order.deliveryType === 'delivery') {
    lines.push(
      `🛵 *Envío (${order.deliveryZoneName}):* ${order.deliveryCostCop === 0 ? 'Gratis' : formatPrice(deliveryCostUsd, order.rates, order.currency)}`,
      `✅ *TOTAL:* ${formatPrice(grandTotalUsd, order.rates, order.currency)}`,
      '',
      `📍 *Dirección:* ${order.deliveryAddress}`
    );
  } else {
    lines.push(
      `🏪 *Entrega:* Retiro en tienda`,
      `✅ *TOTAL:* ${formatPrice(order.totalUsd, order.rates, order.currency)}`
    );
  }

  if (order.notes) {
    lines.push('', `📝 *Notas:* ${order.notes}`);
  }

  lines.push('', '─────────────────────');

  if (method && Object.keys(method.details).length > 0) {
    lines.push(`💳 *Método de pago:* ${method.label}`, '');
    Object.entries(method.details).forEach(([key, value]) => {
      lines.push(`   • *${key}:* ${value}`);
    });
    if (method.note) lines.push('', `⚠️ ${method.note}`);
  } else if (order.paymentMethod === 'efectivo') {
    lines.push('💵 *Método de pago:* Efectivo (paga al domiciliario)');
  }

  lines.push('', '_Pedido realizado desde elrellenito.com_');

  return lines.join('\n');
}

export function openWhatsApp(message: string): void {
  const encoded = encodeURIComponent(message);
  window.open(`https://wa.me/${BUSINESS_WHATSAPP}?text=${encoded}`, '_blank');
}

/**
 * Normaliza un número telefónico al formato internacional que entiende wa.me
 * (solo dígitos, con código de país, sin el 0 inicial nacional).
 *
 * Los clientes suelen escribir el número en formato local venezolano, p. ej.
 * "0412-0688720" → "584120688720". Sin esta conversión, wa.me abre un chat
 * inválido porque le falta el código de país (58) y le sobra el 0 inicial.
 *
 * Casos cubiertos:
 *  - "00..."        → prefijo internacional: se quitan los ceros iniciales.
 *  - "0XXXXXXXXXX"  → formato nacional VE: 0 → código de país (58).
 *  - "58.." / "57.."→ ya viene con código de país: se deja igual.
 *  - "4XXXXXXXXX"   → móvil VE de 10 dígitos sin 0 → 58 + número.
 *  - "3XXXXXXXXX"   → móvil CO de 10 dígitos → 57 + número.
 *  - otro corto     → se antepone el código de país por defecto.
 *
 * Devuelve '' si no hay dígitos.
 */
export function normalizeWhatsAppNumber(
  raw: string | null | undefined,
  countryCode = '58',
): string {
  let d = (raw ?? '').replace(/\D/g, '');
  if (!d) return '';

  if (d.startsWith('00')) {
    d = d.replace(/^0+/, ''); // prefijo internacional 00…
  } else if (d.startsWith('0')) {
    d = countryCode + d.slice(1); // 0 nacional (VE) → código de país
  } else if (d.length >= 11 && (d.startsWith('58') || d.startsWith('57'))) {
    // ya trae código de país (Venezuela / Colombia): se deja igual
  } else if (d.length === 10 && d.startsWith('4')) {
    d = countryCode + d; // móvil VE sin 0 (412/414/416/424/426)
  } else if (d.length === 10 && d.startsWith('3')) {
    d = '57' + d; // móvil CO
  } else if (d.length <= 10) {
    d = countryCode + d; // fallback: número corto sin código
  }

  return d;
}
