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
