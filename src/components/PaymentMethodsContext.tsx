'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { paymentMethods as staticMethods, type PaymentMethod } from '@/lib/payments';

interface PaymentMethodsValue {
  methods: PaymentMethod[];
  loading: boolean;
  reload: () => Promise<void>;
}

const PaymentMethodsContext = createContext<PaymentMethodsValue | null>(null);

/**
 * Carga los métodos de pago desde /api/payment-methods (gestionables en Ventas →
 * Pagos). Siembra desde la lista estática para pintar al instante y seguir
 * funcionando si la API falla. Mismo patrón que `CategoriesContext`.
 */
export function PaymentMethodsProvider({ children }: { children: ReactNode }) {
  const [methods, setMethods] = useState<PaymentMethod[]>(staticMethods);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/payment-methods');
      if (res.ok) {
        const data = await res.json() as PaymentMethod[];
        if (Array.isArray(data) && data.length > 0) setMethods(data);
      }
    } catch { /* mantener lo que haya */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return <PaymentMethodsContext.Provider value={{ methods, loading, reload }}>{children}</PaymentMethodsContext.Provider>;
}

export function usePaymentMethods(): PaymentMethodsValue {
  const ctx = useContext(PaymentMethodsContext);
  if (ctx) return ctx;
  // Fallback defensivo (fuera del provider): lista estática.
  return { methods: staticMethods, loading: false, reload: async () => {} };
}
