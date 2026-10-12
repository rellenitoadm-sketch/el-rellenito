/**
 * Tickets (facturas) de pedidos: tipos y helpers compartidos entre el servidor,
 * la página pública /t/<code> y el panel. Sin dependencias de servidor.
 */

import { paymentMethods } from './payments';

export type TicketKind = 'detal' | 'mayor';

export interface TicketItem {
  name: string;
  qty: number;
  unit_usd: number;
  unit_cop: number;
}

/** Detalles opcionales que cambian según el tipo de pedido. */
export interface TicketMeta {
  delivery_type?: string | null;
  delivery_zone?: string | null;
  delivery_address?: string | null;
  /** YYYY-MM-DD de entrega o encargo. */
  date?: string | null;
  time?: string | null;
  route?: string | null;
  notes?: string | null;
  advance_usd?: number | null;
  remaining_usd?: number | null;
}

export interface Ticket {
  id: string;
  number: number;
  code: string;
  kind: TicketKind;
  order_id: string | null;
  wholesale_order_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  items: TicketItem[];
  total_usd: number;
  total_cop: number;
  payment_method: string | null;
  meta: TicketMeta;
  created_at: string;
}

/** Alfabeto sin 0/O/1/I/l para que el código se pueda dictar sin confundirse. */
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
export const TICKET_CODE_LENGTH = 8;

export function isTicketCode(v: unknown): v is string {
  return typeof v === 'string' && new RegExp(`^[${CODE_ALPHABET}]{${TICKET_CODE_LENGTH}}$`).test(v);
}

export function newTicketCode(): string {
  const bytes = new Uint8Array(TICKET_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

export function ticketNumber(n: number): string {
  return `#${String(n).padStart(3, '0')}`;
}

export function ticketUrl(origin: string, code: string): string {
  return `${origin.replace(/\/$/, '')}/t/${code}`;
}

export function paymentLabel(method: string | null): string {
  if (!method) return '';
  return paymentMethods.find(m => m.id === method)?.label ?? method.replace(/_/g, ' ');
}

export function deliveryLabel(type: string | null | undefined): string {
  return type === 'delivery' ? 'Domicilio' : type === 'retiro' ? 'Retiro en tienda' : '';
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Ítems de un pedido de la web (`price_usd`/`price_cop` por unidad). */
export function ticketItemsFromWeb(items: unknown): TicketItem[] {
  if (!Array.isArray(items)) return [];
  return (items as Record<string, unknown>[])
    .filter(i => typeof i?.name === 'string' && num(i.qty) > 0)
    .map(i => ({
      name: String(i.name),
      qty: num(i.qty),
      unit_usd: num(i.price_usd),
      unit_cop: num(i.price_cop),
    }));
}

/** Ítems de un pedido mayorista por teléfono (`unit_usd`/`unit_cop`). */
export function ticketItemsFromWholesale(items: unknown): TicketItem[] {
  if (!Array.isArray(items)) return [];
  return (items as Record<string, unknown>[])
    .filter(i => typeof i?.name === 'string' && num(i.qty) > 0)
    .map(i => ({
      name: String(i.name),
      qty: num(i.qty),
      unit_usd: num(i.unit_usd),
      unit_cop: num(i.unit_cop),
    }));
}

/** Diferencia entre el total y la suma de líneas (p. ej. recargo de fritos). */
export function ticketExtraUsd(t: Pick<Ticket, 'items' | 'total_usd'>): number {
  const sum = t.items.reduce((s, i) => s + i.qty * i.unit_usd, 0);
  const extra = t.total_usd - sum;
  return extra > 0.009 ? extra : 0;
}

export function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function fmtCop(n: number): string {
  return `COP ${Math.round(n).toLocaleString('es-CO')}`;
}

/** "2026-10-12" → "12 oct 2026". Acepta también un ISO completo. */
export function fmtTicketDate(iso: string): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(`${iso}T12:00:00`) : new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Caracas' });
}

/** Mensaje predeterminado al mandar el ticket por WhatsApp. El link se ve como tarjeta con la imagen. */
export function ticketShareText(t: Pick<Ticket, 'customer_name' | 'number' | 'total_usd'>, url: string): string {
  return `¡Hola ${t.customer_name}! 🧡 Gracias por tu compra en El Rellenito. Aquí está tu ticket ${ticketNumber(t.number)} por ${fmtUsd(t.total_usd)}:\n${url}`;
}
