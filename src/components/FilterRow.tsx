'use client';

import { useState, useRef, useEffect } from 'react';
import { LayoutGrid, LayoutList, Search, ChevronDown } from 'lucide-react';
import { useCurrency, type Currency } from './CurrencyContext';

export type ViewMode = 'list' | 'grid';

interface FilterRowProps {
  search: string;
  onSearchChange: (s: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
}

const CURRENCIES: { id: Currency; label: string; full: string }[] = [
  { id: 'COP', label: 'COP', full: 'Pesos Colombianos' },
  { id: 'USD', label: 'USD', full: 'Dólares' },
  { id: 'BS', label: 'Bs', full: 'Bolívares' },
];

export default function FilterRow({ search, onSearchChange, viewMode, onViewModeChange }: FilterRowProps) {
  const { currency, setCurrency } = useCurrency();
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: PointerEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCurrencyOpen(false);
      }
    }
    if (currencyOpen) document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [currencyOpen]);

  const activeLabel = CURRENCIES.find(c => c.id === currency)?.label ?? currency;

  return (
    <div className="px-4 py-2.5 border-b" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-0">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] pointer-events-none"
            strokeWidth={2.25}
            style={{ color: 'var(--text-3)' }}
          />
          <input
            type="text"
            placeholder="Buscar producto…"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            className="field"
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>

        {/* Currency — discreet dropdown */}
        <div className="relative flex-shrink-0" ref={dropdownRef}>
          <button
            onClick={() => setCurrencyOpen(o => !o)}
            className="flex items-center gap-1 px-2.5 py-2 rounded-[10px] text-[12px] font-bold transition-colors"
            style={{ background: 'var(--surface-2)', color: 'var(--text-1)', border: '1px solid var(--border)' }}
            aria-label="Cambiar moneda"
            aria-expanded={currencyOpen}
          >
            <span className="min-w-[26px] text-center">{activeLabel}</span>
            <ChevronDown
              className="w-3 h-3 transition-transform"
              style={{ color: 'var(--text-3)', transform: currencyOpen ? 'rotate(180deg)' : 'none' }}
            />
          </button>
          {currencyOpen && (
            <div
              className="absolute right-0 top-full mt-1.5 rounded-[12px] py-1.5 min-w-[200px] z-30 overflow-hidden"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: 'var(--sh-3)' }}
            >
              {CURRENCIES.map(c => {
                const active = currency === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => { setCurrency(c.id); setCurrencyOpen(false); }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-[var(--surface-2)]"
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

        {/* View toggle */}
        <div className="flex rounded-[10px] overflow-hidden flex-shrink-0" style={{ border: '1px solid var(--border)' }}>
          <button
            onClick={() => onViewModeChange('list')}
            className="p-2 transition-colors"
            style={{
              background: viewMode === 'list' ? 'var(--brand)' : 'var(--surface-2)',
              color: viewMode === 'list' ? '#fff' : 'var(--text-3)',
            }}
            aria-label="Vista lista"
          >
            <LayoutList className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onViewModeChange('grid')}
            className="p-2 transition-colors"
            style={{
              background: viewMode === 'grid' ? 'var(--brand)' : 'var(--surface-2)',
              color: viewMode === 'grid' ? '#fff' : 'var(--text-3)',
            }}
            aria-label="Vista cuadrícula"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
