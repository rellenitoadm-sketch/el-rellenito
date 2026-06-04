export type PaymentMethodId =
  | 'pago_movil'
  | 'zelle'
  | 'binance'
  | 'transferencia_ve'
  | 'bancolombia'
  | 'efectivo';

export interface PaymentMethod {
  id: PaymentMethodId;
  label: string;
  icon: string; // nombre del icono Lucide
  details: Record<string, string>;
  note?: string;
}

export const paymentMethods: PaymentMethod[] = [
  {
    id: 'pago_movil',
    label: 'Pago Móvil',
    icon: 'Smartphone',
    details: {
      Banco: 'Banco Provincial (0108)',
      Teléfono: '+58 412-339-3602',
      'C.I.': 'V-10.153.486',
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
