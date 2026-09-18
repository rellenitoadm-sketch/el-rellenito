/**
 * Pedidos mayoristas por teléfono: tipos y cálculos compartidos entre las rutas
 * /api/admin/wholesale-orders y el panel del equipo. Sin dependencias de servidor.
 */

export type WholesaleOrderStatus = 'registrado' | 'entregado' | 'cancelado';
export type PaymentOutcome = 'pagado' | 'abono' | 'no_pago';
export type PaymentCurrency = 'COP' | 'VES' | 'USD';

export interface WholesaleOrderItem {
  product_id: string;
  flavor_id: string | null;
  name: string;
  qty: number;
  unit_usd: number;
  unit_cop: number;
}

export interface WholesalePayment {
  id: string;
  order_id: string;
  collected_on: string;
  outcome: PaymentOutcome;
  currency: PaymentCurrency | null;
  amount: number;
  rate_ves: number | null;
  share: number;
  driver_id: string | null;
  driver_name: string | null;
  note: string | null;
  created_at: string;
}

export interface WholesaleOrder {
  id: string;
  client_id: string | null;
  client_name: string;
  client_phone: string | null;
  client_address: string | null;
  client_route: string | null;
  delivery_date: string;
  items: WholesaleOrderItem[];
  total_usd: number;
  total_cop: number;
  status: WholesaleOrderStatus;
  driver_id: string | null;
  driver_name: string | null;
  assigned_at: string | null;
  delivered_at: string | null;
  paid_share: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  payments: WholesalePayment[];
}

export interface StoredRates {
  bs_per_usd: number;
  cop_per_usd: number;
}

/** Línea tal como la manda el formulario: el precio lo pone siempre el servidor. */
export interface OrderLineInput {
  product_id: string;
  flavor_id: string | null;
  qty: number;
}

/**
 * Diferencia en pesos por debajo de la cual un pedido se da por saldado. Evita
 * saldos fantasma de centavos al convertir entre monedas.
 */
export const COP_TOLERANCE = 100;

/** Umbral usado en la consulta de saldos pendientes (paid_share < este valor). */
export const SETTLED_SHARE = 0.9995;

/** Cuánto se puede planificar hacia adelante al registrar un pedido. */
export const MAX_AHEAD_DAYS = 120;

/** Hasta cuántos días atrás se arrastran los pedidos sin cerrar. */
export const CARRYOVER_DAYS = 90;

/** Búsqueda tolerante: sin acentos ni mayúsculas ("maria" encuentra "MARÍA"). */
export function normalizeSearch(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const CARACAS_DATE = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit',
});

/**
 * Fecha de hoy en Venezuela (YYYY-MM-DD). `toISOString()` da la fecha UTC, que a
 * las 8pm de Caracas ya es el día siguiente: justo la hora del cierre de cobros.
 */
export function caracasDate(d: Date = new Date()): string {
  return CARACAS_DATE.format(d);
}

export function isYmd(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`));
}

export function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "mar 16 sep" para encabezados de fecha. */
export function formatYmd(ymd: string): string {
  return new Date(`${ymd}T12:00:00Z`).toLocaleDateString('es-VE', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

export const lineKey = (productId: string, flavorId: string | null) =>
  flavorId ? `${productId}::${flavorId}` : productId;

interface PricedProduct {
  wholesale_price_usd: number;
  wholesale_price_cop: number | null;
}
interface PricedFlavorRow {
  price_usd?: number | null;
  price_cop?: number | null;
  wholesale_price_usd?: number | null;
  wholesale_price_cop?: number | null;
}

/**
 * Precio al mayor por unidad. Mismo orden que la tienda al mayor
 * (WholesalePage): precio al mayor del sabor → precio del sabor → precio al mayor
 * del producto. Sin precio en pesos se deriva de USD × tasa.
 */
export function wholesaleUnitPrices(
  product: PricedProduct,
  flavor: PricedFlavorRow | null,
  copPerUsd: number,
): { unit_usd: number; unit_cop: number } {
  const usd = flavor
    ? (flavor.wholesale_price_usd ?? flavor.price_usd ?? product.wholesale_price_usd)
    : product.wholesale_price_usd;
  const cop = flavor
    ? (flavor.wholesale_price_cop ?? flavor.price_cop ?? product.wholesale_price_cop)
    : product.wholesale_price_cop;
  return {
    unit_usd: Number(usd),
    unit_cop: cop != null ? Number(cop) : Math.round(Number(usd) * copPerUsd),
  };
}

export function orderTotals(items: Pick<WholesaleOrderItem, 'qty' | 'unit_usd' | 'unit_cop'>[]) {
  let usd = 0;
  let cop = 0;
  for (const i of items) {
    usd += i.qty * i.unit_usd;
    cop += i.qty * i.unit_cop;
  }
  return { total_usd: Math.round(usd * 100) / 100, total_cop: Math.round(cop) };
}

type Totals = Pick<WholesaleOrder, 'total_usd' | 'total_cop'>;

/**
 * Fracción del pedido que cubre un monto. Pesos se mide contra el total en pesos
 * y dólares/bolívares contra el total en dólares: son listas de precio propias,
 * así que pagar exactamente el total en pesos salda el pedido sin residuos.
 */
export function shareOf(amount: number, currency: PaymentCurrency, order: Totals, rateVes: number | null): number {
  if (currency === 'COP') return order.total_cop > 0 ? amount / order.total_cop : 0;
  const usd = currency === 'USD' ? amount : amount / (rateVes || 1);
  return order.total_usd > 0 ? usd / order.total_usd : 0;
}

/** Monto que corresponde a una fracción del pedido en la moneda dada. */
export function amountFor(share: number, currency: PaymentCurrency, order: Totals, rateVes: number | null): number {
  if (currency === 'COP') return Math.round(share * order.total_cop);
  const usd = share * order.total_usd;
  return currency === 'USD' ? Math.round(usd * 100) / 100 : Math.round(usd * (rateVes || 0));
}

/** Parte pagada según los cobros guardados (la columna es solo un atajo de consulta). */
export function paidShareOf(payments: Pick<WholesalePayment, 'share'>[]): number {
  const sum = payments.reduce((s, p) => s + Number(p.share), 0);
  return Math.min(1, Math.round(sum * 1e8) / 1e8);
}

export function remainingShare(paidShare: number): number {
  return Math.max(0, 1 - paidShare);
}

export function isSettled(paidShare: number, totalCop: number): boolean {
  return remainingShare(paidShare) * totalCop <= COP_TOLERANCE;
}

export type PaymentState = 'pagado' | 'abonado' | 'pendiente';

export function paymentState(order: Pick<WholesaleOrder, 'paid_share' | 'total_cop'>): PaymentState {
  if (isSettled(order.paid_share, order.total_cop)) return 'pagado';
  return order.paid_share > 0 ? 'abonado' : 'pendiente';
}

export const formatCop = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;
export const formatUsd = (n: number) => `US$${n.toFixed(2)}`;
export const formatVes = (n: number) => `Bs. ${Math.round(n).toLocaleString('es-VE')}`;

export function formatAmount(amount: number, currency: PaymentCurrency): string {
  if (currency === 'COP') return formatCop(amount);
  if (currency === 'USD') return formatUsd(amount);
  return formatVes(amount);
}

export const CURRENCY_LABEL: Record<PaymentCurrency, string> = {
  COP: 'Pesos',
  VES: 'Bolívares',
  USD: 'Dólares',
};

/** Compara domiciliarios por id cuando lo hay; si no, por nombre sin mayúsculas. */
export function sameDriver(
  a: { id: string | null; name: string },
  b: { driver_id: string | null; driver_name: string | null },
): boolean {
  if (!b.driver_name) return false;
  if (a.id && b.driver_id) return a.id === b.driver_id;
  return a.name.trim().toLowerCase() === b.driver_name.trim().toLowerCase();
}
