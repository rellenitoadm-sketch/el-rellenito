import type { stockState } from '@/lib/inventory';

type State = ReturnType<typeof stockState>;

const LOOK: Record<State, { label: string; bg: string; fg: string; bar: string }> = {
  ok: { label: 'En stock', bg: 'var(--success-soft)', fg: '#15803D', bar: '#16A34A' },
  bajo: { label: 'Stock bajo', bg: 'var(--warning-soft)', fg: '#B45309', bar: '#F59E0B' },
  agotado: { label: 'Agotado', bg: 'var(--danger-soft)', fg: '#B91C1C', bar: '#DC2626' },
  sin_cargar: { label: 'Sin cargar', bg: 'var(--surface-2)', fg: 'var(--text-3)', bar: '#A8A29E' },
};

export const stockColor = (s: State) => LOOK[s].bar;

export function StockBadge({ state }: { state: State }) {
  const l = LOOK[state];
  return (
    <span className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-md mt-1" style={{ background: l.bg, color: l.fg }}>
      {l.label}
    </span>
  );
}
