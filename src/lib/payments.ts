/**
 * `string` porque el admin puede crear o borrar métodos desde el panel (Ventas
 * → Pagos): ya no es un set fijo de valores conocidos en código.
 */
export type PaymentMethodId = string;

export interface PaymentMethod {
  id: string;
  label: string;
  icon: string; // nombre del icono Lucide
  details: Record<string, string>;
  note?: string;
}

/**
 * Datos de respaldo si la tabla `payment_methods` de Supabase no responde (igual
 * que `products.ts` respalda a `/api/products`). La fuente real y EDITABLE desde
 * el panel (Ventas → Pagos) es la tabla; `PaymentMethodsContext` la consulta y
 * cae a esta lista si falla. Mantener esto al día es opcional/cosmético.
 */
export const paymentMethods: PaymentMethod[] = [
  {
    id: 'pago_movil',
    label: 'Pago Móvil',
    icon: 'Smartphone',
    details: {
      Banco: 'Banco Provincial (0108)',
      Teléfono: '0412-339-3602',
      'C.I.': 'V-29.649.099',
      Titular: 'Nahomy Parada',
    },
  },
  {
    id: 'zelle',
    label: 'Zelle',
    icon: 'DollarSign',
    details: {
      Email: '8012274203',
      Titular: 'Sandra Zambrano-Sanchez',
      Banco: 'Regions Bank',
    },
  },
  {
    id: 'binance',
    label: 'Binance / USDT',
    icon: 'Coins',
    details: {
      Usuario: 'panchoelmillonario',
      ID: '1061511313',
      Correo: 'kiliansc@gmail.com',
    },
    note: 'Enviar captura del comprobante por WhatsApp',
  },
  {
    id: 'transferencia_ve',
    label: 'Transferencia VE',
    icon: 'Building2',
    details: {
      Banco: 'Banco Provincial',
      Cuenta: '0108-0070-65-0100478228',
      Tipo: 'Corriente',
      'C.I.': '29.649.099',
      Titular: 'Nahomy Parada',
    },
  },
  {
    id: 'bancolombia',
    label: 'Bancolombia',
    icon: 'CreditCard',
    details: {
      Cuenta: '82400014851',
      Tipo: 'Ahorros',
      Documento: '176.277.226',
      Titular: 'Kilian Vega',
    },
  },
  {
    id: 'efectivo',
    label: 'Efectivo',
    icon: 'Banknote',
    details: {},
    note: 'Paga directamente al domiciliario en la entrega',
  },
];
