'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { useCart } from './CartContext';

export default function AddedToast() {
  const { lastAdded } = useCart();

  return (
    <AnimatePresence>
      {lastAdded && (
        <motion.div
          key={lastAdded.key}
          initial={{ opacity: 0, y: -12, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="fixed top-4 right-4 z-[60] flex items-center gap-2.5 rounded-xl px-4 py-2.5 shadow-lg border"
          style={{
            background: 'var(--surface)',
            borderColor: 'rgba(255,81,0,0.35)',
            boxShadow: 'var(--glow-sm)',
          }}
        >
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[var(--brand-orange)] flex-shrink-0">
            <Check className="w-3 h-3 text-white" strokeWidth={3} />
          </span>
          <span className="text-sm font-semibold max-w-[180px] truncate" style={{ color: 'var(--text-primary)' }}>
            {lastAdded.name}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>añadido</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
