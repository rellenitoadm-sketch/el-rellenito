'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { ExchangeRates } from '@/lib/rates';
import { formatPrice } from '@/lib/rates';

export type Currency = 'COP' | 'USD' | 'BS';

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  rates: ExchangeRates;
  /**
   * Formatea un monto en la moneda activa. Pasa `cop` (precio en COP fijado por
   * el cliente) cuando exista; si se omite, COP se deriva de USD × tasa.
   * Bs siempre se deriva del USD.
   */
  format: (usd: number, cop?: number | null) => string;
  isLoading: boolean;
}

const FALLBACK_RATES: ExchangeRates = {
  bs_per_usd: 535.28,
  cop_per_usd: 4200,
  updated_at: new Date().toISOString(),
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency>('COP');
  const [rates, setRates] = useState<ExchangeRates>(FALLBACK_RATES);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = () =>
      fetch('/api/rates')
        .then(r => r.json())
        .then((data: ExchangeRates) => {
          setRates(data);
          setIsLoading(false);
        })
        .catch(() => setIsLoading(false));
    load();
    // La PWA suele quedarse abierta horas: re-consultar periódicamente y al
    // volver a primer plano, para que la tasa BCV nueva se vea sin recargar.
    const interval = setInterval(load, 10 * 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const format = (usd: number, cop?: number | null) => formatPrice(usd, rates, currency, cop);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rates, format, isLoading }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error('useCurrency must be inside CurrencyProvider');
  return ctx;
}
