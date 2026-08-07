'use client';

import { LayoutGrid, LayoutList, Search } from 'lucide-react';
import CurrencySelector from './CurrencySelector';

export type ViewMode = 'list' | 'grid';

interface FilterRowProps {
  search: string;
  onSearchChange: (s: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (v: ViewMode) => void;
}

export default function FilterRow({ search, onSearchChange, viewMode, onViewModeChange }: FilterRowProps) {
  return (
    <div className="px-4 py-2.5 border-b" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-0" data-tour="search">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-[18px] h-[18px] pointer-events-none"
            strokeWidth={2.25}
            style={{ color: 'var(--text-3)' }}
          />
          <input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            aria-label="Buscar producto"
            placeholder="Buscar producto…"
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            className="field"
            style={{ paddingLeft: '2.5rem', minHeight: 44 }}
          />
        </div>

        {/* Currency — discreet dropdown */}
        <CurrencySelector />

        {/* View toggle */}
        <div data-tour="view" className="flex rounded-[10px] overflow-hidden flex-shrink-0" style={{ border: '1px solid var(--border)' }}>
          <button
            onClick={() => onViewModeChange('list')}
            className="flex items-center justify-center min-h-[44px] min-w-[44px] transition-colors"
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
            className="flex items-center justify-center min-h-[44px] min-w-[44px] transition-colors"
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
