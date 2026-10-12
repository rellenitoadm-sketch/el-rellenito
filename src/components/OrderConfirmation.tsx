'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { CheckCircle } from 'lucide-react';
import { TicketCard } from './TicketCard';
import { TicketActions } from './TicketActions';
import type { Ticket } from '@/lib/tickets';

const WEB_FONTS = { serif: 'var(--font-playfair), Georgia, serif', sans: 'var(--font-inter), Helvetica, sans-serif' };

/**
 * Pantalla de "pedido recibido": el ticket como confirmación, con imprimir y
 * descargar. Si el ticket no se pudo crear, cae a un aviso simple.
 */
export default function OrderConfirmation({ ticket, onClose, closeLabel = 'Cerrar', children }: {
  ticket: Ticket | null;
  onClose: () => void;
  closeLabel?: string;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="h-full min-h-screen overflow-y-auto px-4 py-8" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <motion.div
          initial={reduce ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
          className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
          style={{ background: 'var(--success-soft)' }}
        >
          <CheckCircle className="w-9 h-9" style={{ color: 'var(--success)' }} aria-hidden />
        </motion.div>
        <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text-1)' }}>¡Pedido recibido!</h2>
        <div className="text-sm mb-5 leading-relaxed" style={{ color: 'var(--text-2)' }}>{children}</div>

        {ticket && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.35 }}
            className="w-full text-left flex flex-col gap-3"
          >
            <div className="rounded-[28px]" style={{ boxShadow: 'var(--sh-3)' }}>
              <TicketCard ticket={ticket} logoSrc="/logo-circle.png" fonts={WEB_FONTS} />
            </div>
            <TicketActions code={ticket.code} number={ticket.number} />
          </motion.div>
        )}

        <button onClick={onClose} className="mt-6 w-full btn-gradient text-white font-bold py-4 rounded-2xl">
          {closeLabel}
        </button>
      </div>
    </div>
  );
}
