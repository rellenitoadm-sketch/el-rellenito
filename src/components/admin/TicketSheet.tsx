'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, Copy, Download, Loader2, MessageCircle, X } from 'lucide-react';
import { TicketCard } from '../TicketCard';
import { normalizeWhatsAppNumber } from '@/lib/whatsapp';
import { ticketNumber, ticketShareText, ticketUrl, type Ticket } from '@/lib/tickets';

const WEB_FONTS = { serif: 'var(--font-playfair), Georgia, serif', sans: 'var(--font-inter), Helvetica, sans-serif' };

type Source = { ticket: Ticket } | { orderId: string } | { wholesaleOrderId: string };

/**
 * Visor del ticket con las acciones de compartir. Acepta el ticket ya cargado o
 * el id del pedido: lo busca, y si el pedido es anterior a los tickets lo crea.
 */
export default function TicketSheet({ source, onClose }: { source: Source; onClose: () => void }) {
  const reduce = useReducedMotion();
  const [ticket, setTicket] = useState<Ticket | null>('ticket' in source ? source.ticket : null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const ref = 'orderId' in source ? { order_id: source.orderId }
    : 'wholesaleOrderId' in source ? { wholesale_order_id: source.wholesaleOrderId }
    : null;
  const refKey = ref ? JSON.stringify(ref) : '';

  useEffect(() => {
    if (!refKey) return;
    let off = false;
    (async () => {
      try {
        const q = new URLSearchParams(JSON.parse(refKey) as Record<string, string>).toString();
        const found = await (await fetch(`/api/admin/tickets?${q}`)).json() as { ticket: Ticket | null };
        if (found.ticket) { if (!off) setTicket(found.ticket); return; }
        const res = await fetch('/api/admin/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: refKey });
        const created = await res.json() as { ticket?: Ticket; error?: string };
        if (!off) { if (created.ticket) setTicket(created.ticket); else setError(created.error ?? 'No se pudo crear el ticket.'); }
      } catch {
        if (!off) setError('No se pudo cargar el ticket. Revisa tu conexión.');
      }
    })();
    return () => { off = true; };
  }, [refKey]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const link = ticket ? ticketUrl(window.location.origin, ticket.code) : '';
  const text = ticket ? ticketShareText(ticket, link) : '';
  const phone = normalizeWhatsAppNumber(ticket?.customer_phone);

  const openWhatsApp = useCallback(() => {
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }, [phone, text]);

  /** Móvil: comparte la imagen. Si el navegador no puede, abre WhatsApp con el link. */
  const share = async () => {
    if (!ticket) return;
    setSharing(true);
    try {
      const blob = await (await fetch(`/t/${ticket.code}/image`)).blob();
      const file = new File([blob], `ticket-${ticket.number}.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return; // canceló el menú de compartir
    } finally {
      setSharing(false);
    }
    openWhatsApp();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* sin portapapeles: el link se puede mandar por WhatsApp */ }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label={ticket ? `Ticket ${ticketNumber(ticket.number)}` : 'Ticket'}
        initial={reduce ? false : { y: '100%', opacity: 0.5 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="relative w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col"
        style={{ background: '#FFE9DC', maxHeight: '94vh' }}
      >
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
          <h3 className="font-bold text-[15px]" style={{ color: 'var(--text-1)' }}>
            {ticket ? `Ticket ${ticketNumber(ticket.number)}` : 'Ticket'}
          </h3>
          <button ref={closeRef} onClick={onClose} className="w-11 h-11 -mr-2 flex items-center justify-center rounded-full" style={{ color: 'var(--text-2)' }} aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {error ? (
            <p className="text-[13px] text-center py-10" style={{ color: '#B91C1C' }}>{error}</p>
          ) : !ticket ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--brand)' }} /></div>
          ) : (
            <TicketCard ticket={ticket} logoSrc="/logo-circle.png" fonts={WEB_FONTS} />
          )}
        </div>

        {ticket && (
          <div className="px-4 pt-3 pb-4 flex-shrink-0 space-y-2" style={{ background: 'var(--surface)' }}>
            <button onClick={share} disabled={sharing} className="btn btn-primary w-full justify-center" style={{ minHeight: 48 }}>
              {sharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
              Enviar por WhatsApp
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={copy} className="btn btn-secondary justify-center" style={{ minHeight: 44 }}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copiado' : 'Copiar link'}
              </button>
              <a href={`/t/${ticket.code}/image`} download={`ticket-${ticket.number}.png`} className="btn btn-secondary justify-center" style={{ minHeight: 44 }}>
                <Download className="w-4 h-4" /> Descargar
              </a>
            </div>
            {!phone && <p className="text-[11px] text-center" style={{ color: 'var(--text-3)' }}>Sin teléfono: WhatsApp te dejará elegir el contacto.</p>}
          </div>
        )}
      </motion.div>
    </div>
  );
}
