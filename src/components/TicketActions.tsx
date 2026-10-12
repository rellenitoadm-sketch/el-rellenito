'use client';

import { useEffect } from 'react';
import { Download, Printer } from 'lucide-react';

/**
 * Imprimir y descargar el ticket. Con `inline` imprime la página actual (la de
 * /t/<code>); si no, abre esa página en otra pestaña y allí se imprime sola, para
 * no sacar el resto de la tienda en el papel.
 */
export function TicketActions({ code, number, inline }: { code: string; number: number; inline?: boolean }) {
  const print = () => {
    if (inline) window.print();
    else window.open(`/t/${code}?print=1`, '_blank', 'noopener');
  };
  return (
    <div className="flex w-full gap-3 print:hidden">
      <button type="button" onClick={print} className="btn btn-primary flex-1 justify-center" style={{ minHeight: 48 }}>
        <Printer className="w-4 h-4" aria-hidden /> Imprimir
      </button>
      <a href={`/t/${code}/image`} download={`ticket-${number}.png`} className="btn btn-secondary flex-1 justify-center" style={{ minHeight: 48 }}>
        <Download className="w-4 h-4" aria-hidden /> Descargar
      </a>
    </div>
  );
}

/** Abre el diálogo de impresión al cargar /t/<code>?print=1. */
export function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, []);
  return null;
}
