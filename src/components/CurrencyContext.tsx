'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { ExchangeRates } from '@/lib/rates';
import { formatPrice } from '@/lib/rates';

export type Currency = 'COP' | 'USD' | 'BS';

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  rates: ExchangeRates;
  format: (usd: number) => string;
  isLoading: boolean;
}

const FALLBACK_RATES: ExchangeRates = {
  bs_per_usd: 92.0,
  cop_per_usd: 4200,
  updated_at: new Date().toISOString(),
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency>('COP');
  const [rates, setRates] = useState<ExchangeRates>(FALLBACK_RATES);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/rates')
      .then(r => r.json())
      .then((data: ExchangeRates) => {
        setRates(data);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, []);

  const format = (usd: number) => formatPrice(usd, rates, currency);

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
