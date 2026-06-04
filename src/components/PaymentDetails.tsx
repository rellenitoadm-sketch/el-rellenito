'use client';

import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { paymentMethods, type PaymentMethodId } from '@/lib/payments';

interface PaymentDetailsProps {
  methodId: PaymentMethodId;
}

export default function PaymentDetails({ methodId }: PaymentDetailsProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const method = paymentMethods.find(m => m.id === methodId);
  if (!method) return null;

  const hasDetails = Object.keys(method.details).length > 0;

  const copyValue = (value: string) => {
    navigator.clipboard.writeText(value).catch(() => {});
    setCopied(value);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="rounded-xl p-3 border" style={{ background: 'var(--surface-2)', borderColor: 'rgba(255,81,0,0.2)' }}>
      <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--brand-orange)' }}>
        Datos de {method.label}
      </p>
      {hasDetails ? (
        <div className="space-y-1.5">
          {Object.entries(method.details).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between gap-2">
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{key}:</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</span>
                <button
                  onClick={() => copyValue(value)}
                  aria-label={`Copiar ${key}`}
                  className="transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {copied === value ? (
                    <Check className="w-3 h-3" style={{ color: 'var(--success)' }} />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{method.note ?? 'Paga al recibir tu pedido.'}</p>
      )}
      {method.note && hasDetails && (
        <p className="text-xs mt-2 pt-2 border-t" style={{ color: 'var(--brand-gold)', borderColor: 'var(--border)' }}>
          ⚠️ {method.note}
        </p>
      )}
    </div>
  );
}
