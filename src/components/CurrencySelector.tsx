'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useCurrency, type Currency } from './CurrencyContext';

const CURRENCIES: { id: Currency; label: string; full: string }[] = [
  { id: 'COP', label: 'COP', full: 'Pesos Colombianos' },
  { id: 'USD', label: 'USD', full: 'Dólares (referencia BCV)' },
  { id: 'BS', label: 'Bs', full: 'Bolívares' },
];

interface CurrencySelectorProps {
  align?: 'left' | 'right';
  /** data-tour del elemento — distinto por instancia para que el tutorial resalte la correcta. */
  tourId?: string;
}

export default function CurrencySelector({ align = 'right', tourId = 'currency' }: CurrencySelectorProps) {
  const { currency, setCurrency } = useCurrency();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: PointerEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [open]);

  const activeLabel = CURRENCIES.find(c => c.id === currency)?.label ?? currency;

  return (
    <div className="relative flex-shrink-0" ref={dropdownRef} data-tour={tourId}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 px-2.5 rounded-[10px] text-[12px] font-bold transition-colors"
        style={{ background: 'var(--surface-2)', color: 'var(--text-1)', border: '1px solid var(--border)', minHeight: 44 }}
        aria-label="Cambiar moneda"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="min-w-[26px] text-center">{activeLabel}</span>
        <ChevronDown
          className="w-3 h-3 transition-transform"
          style={{ color: 'var(--text-3)', transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>
      {open && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-1.5 rounded-[12px] py-1.5 min-w-[200px] z-30 overflow-hidden`}
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--sh-3)' }}
        >
          {CURRENCIES.map(c => {
            const active = currency === c.id;
            return (
              <button
                key={c.id}
                onClick={() => { setCurrency(c.id); setOpen(false); }}
                className="w-full flex items-center gap-3 px-3.5 py-2.5 min-h-[44px] text-left transition-colors hover:bg-[var(--surface-2)]"
              >
                <span
                  className="w-9 flex-shrink-0 text-[14px] font-bold"
                  style={{ color: active ? 'var(--brand)' : 'var(--text-1)' }}
                >
                  {c.label}
                </span>
                <span
                  className="text-[12.5px] whitespace-nowrap"
                  style={{ color: active ? 'var(--brand)' : 'var(--text-3)', fontWeight: active ? 600 : 400 }}
                >
                  {c.full}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
