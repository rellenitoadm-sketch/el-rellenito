'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { Star } from 'lucide-react';
import type { OpenStatus } from '@/lib/businessHours';
import NavMenu from './NavMenu';

/**
 * Slim, always-visible bar at the top of the sticky nav stack.
 * Gives persistent brand identity + open/closed status once the hero
 * has scrolled away. No scroll-linked animation = no jank.
 *
 * The logo doubles as the *secret gesture* to reach the staff panel:
 * 5 quick taps within 1.5s dispatch a 'staff-unlock' event (StaffUnlock listens).
 * Invisible to customers; no link, no hint.
 */
export default function TopBar({ status, onMayorClick }: { status: OpenStatus; onMayorClick: () => void }) {
  const taps = useRef<number[]>([]);

  const handleSecretTap = () => {
    const now = Date.now();
    taps.current = [...taps.current.filter(t => now - t < 1500), now];
    if (taps.current.length >= 5) {
      taps.current = [];
      window.dispatchEvent(new CustomEvent('staff-unlock'));
    }
  };

  return (
    <div
      className="flex items-center gap-2.5 px-4 py-2.5"
      style={{ background: 'var(--surface)' }}
    >
      <div
        onClick={handleSecretTap}
        className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 select-none"
        style={{ background: 'var(--brand-soft)' }}
      >
        <Image src="/logo-circle.png" alt="El Rellenito" width={32} height={32} className="object-cover w-full h-full" draggable={false} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold leading-tight" style={{ color: 'var(--text-1)', fontFamily: 'var(--font-playfair)' }}>
          El Rellenito
        </p>
        <p className="text-[10.5px] flex items-center gap-1 leading-tight" style={{ color: status.open ? '#15803D' : '#B45309' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: status.open ? '#16A34A' : '#D97706' }} />
          {status.label}
        </p>
      </div>

      <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold flex-shrink-0" style={{ color: 'var(--text-2)' }}>
        <Star className="w-3.5 h-3.5 fill-current" style={{ color: 'var(--accent)' }} />
        4.5
      </span>

      <NavMenu onMayorClick={onMayorClick} />
    </div>
  );
}
