'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Cookie } from 'lucide-react';
import { useOnboarding } from './Onboarding';

const STORAGE_KEY = 'rl_cookie_consent';

/**
 * Minimal, GDPR-style cookie notice. The site only uses essential cookies
 * (admin session) + anonymous visit metrics — no third-party ad trackers — so a
 * single "Entendido" acknowledgement is sufficient. Choice persists in
 * localStorage so it shows once.
 */
export default function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const { activeTour } = useOnboarding();

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ at: Date.now() })); } catch { /* ignore */ }
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {/* Se oculta mientras un tutorial está en curso y vuelve a aparecer al
          terminarlo (no se descarta). Persiste en todas las vistas. */}
      {visible && !activeTour && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 280 }}
          className="fixed bottom-3 left-3 right-3 z-[88] mx-auto max-w-md rounded-2xl border p-4 shadow-xl"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
          role="dialog"
          aria-label="Aviso de cookies"
        >
          <div className="flex items-start gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--brand-soft)' }}
            >
              <Cookie className="w-4.5 h-4.5" style={{ color: 'var(--brand-deep)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
                Usamos cookies esenciales y métricas anónimas para mejorar tu experiencia. No
                compartimos tus datos con terceros.{' '}
                <Link href="/privacidad" className="font-semibold underline" style={{ color: 'var(--brand)' }}>
                  Más información
                </Link>
                .
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={accept}
                  className="text-white text-[13px] font-bold px-4 py-2 rounded-xl btn-gradient"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
