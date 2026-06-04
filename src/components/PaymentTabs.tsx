'use client';

import { Smartphone, DollarSign, Coins, Building2, CreditCard, Banknote } from 'lucide-react';
import { paymentMethods, type PaymentMethodId } from '@/lib/payments';

const ICONS: Record<string, React.ElementType> = {
  Smartphone, DollarSign, Coins, Building2, CreditCard, Banknote,
};

interface PaymentTabsProps {
  selected: PaymentMethodId;
  onSelect: (id: PaymentMethodId) => void;
}

export default function PaymentTabs({ selected, onSelect }: PaymentTabsProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {paymentMethods.map(method => {
        const Icon = ICONS[method.icon] ?? Banknote;
        const isSelected = selected === method.id;
        return (
          <button
            key={method.id}
            onClick={() => onSelect(method.id)}
            className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border text-xs font-semibold transition-all duration-150"
            style={
              isSelected
                ? { borderColor: 'var(--brand-orange)', background: 'rgba(255,81,0,0.1)', color: 'var(--brand-orange)' }
                : { borderColor: 'var(--border)', background: 'var(--surface)', color: 'var(--text-secondary)' }
            }
          >
            <Icon className="w-5 h-5" style={{ color: isSelected ? 'var(--brand-orange)' : 'var(--text-muted)' }} />
            <span className="text-center leading-tight">{method.label}</span>
          </button>
        );
      })}
    </div>
  );
}
