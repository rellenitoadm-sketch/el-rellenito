export interface ExchangeRates {
  bs_per_usd: number;
  cop_per_usd: number;
  updated_at: string;
}

// Tasas de fallback — actualizadas al 2026-05-29
// BCV: https://pydolarve.org/api/v1/dollar?page=bcv → monitors.usd.price
const FALLBACK_RATES: ExchangeRates = {
  bs_per_usd: 535.28, // Tasa BCV real (Bs/USD)
  cop_per_usd: 4200,  // Tasa COP/USD aproximada
  updated_at: new Date().toISOString(),
};

export async function getExchangeRates(): Promise<ExchangeRates> {
  try {
    const res = await fetch(
      'https://pydolarve.org/api/v1/dollar?page=bcv',
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) throw new Error(`BCV API error: ${res.status}`);
    const data = await res.json();

    // El campo correcto en pydolarve.org es monitors.usd.price
    const bs_per_usd = data?.monitors?.usd?.price as number;

    if (!bs_per_usd || bs_per_usd <= 0 || bs_per_usd < 100) {
      // Sanity check: tasa BCV nunca puede ser menor a 100 Bs/USD hoy
      console.warn('[BCV] Tasa sospechosa recibida:', bs_per_usd, '— usando fallback');
      throw new Error('Invalid rate');
    }

    return {
      bs_per_usd,
      cop_per_usd: FALLBACK_RATES.cop_per_usd,
      updated_at: new Date().toISOString(),
    };
  } catch (err) {
    console.warn('[BCV] Usando tasa de fallback:', FALLBACK_RATES.bs_per_usd, 'Bs/USD. Error:', err);
    return FALLBACK_RATES;
  }
}

export function formatPrice(usd: number, rates: ExchangeRates, currency: 'USD' | 'COP' | 'BS'): string {
  switch (currency) {
    case 'USD':
      return `$${usd.toFixed(2)}`;
    case 'COP': {
      const cop = usd * rates.cop_per_usd;
      return `$${Math.round(cop).toLocaleString('es-CO')}`;
    }
    case 'BS': {
      const bs = usd * rates.bs_per_usd;
      return `Bs. ${Math.round(bs).toLocaleString('es-VE')}`;
    }
  }
}
