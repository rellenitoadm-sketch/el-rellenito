import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { deliveryLabel, fmtTicketDate, isTicketCode, ticketNumber } from '@/lib/tickets';
import { getTicketByCode } from '@/lib/tickets.server';
import { AutoPrint, PrintButton } from '@/components/TicketActions';

type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ print?: string }> };

export const metadata: Metadata = { title: 'Comanda de cocina · El Rellenito', robots: { index: false, follow: false } };

/**
 * Comanda para cocina: 80 mm, solo negro sobre blanco, letra grande y sin precios.
 * Se imprime en la impresora térmica de rollo.
 */
export default async function KitchenTicketPage({ params, searchParams }: Props) {
  const { code } = await params;
  const { print } = await searchParams;
  if (!supabaseAdmin || !isTicketCode(code)) notFound();
  const t = await getTicketByCode(supabaseAdmin, code);
  if (!t) notFound();

  const delivery = deliveryLabel(t.meta.delivery_type);
  const when = t.meta.date ? fmtTicketDate(t.meta.date) : '';
  const units = t.items.reduce((s, i) => s + i.qty, 0);

  return (
    <main className="kitchen-page">
      <style>{`
        @page { size: 80mm auto; margin: 0; }
        .kitchen-page { min-height: 100dvh; background: #e5e5e5; display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 24px 12px; font-family: Arial, Helvetica, sans-serif; color: #000; }
        .kitchen-paper { width: 80mm; background: #fff; padding: 5mm 4mm 8mm; box-sizing: border-box; }
        .kitchen-paper * { color: #000; }
        .k-row { display: flex; justify-content: space-between; gap: 8px; font-size: 15px; line-height: 1.3; }
        .k-hr { border: 0; border-top: 2px dashed #000; margin: 8px 0; }
        .k-item { display: flex; gap: 10px; align-items: baseline; font-size: 22px; font-weight: 800; line-height: 1.2; padding: 4px 0; }
        .k-qty { min-width: 2.2em; font-size: 30px; }
        @media print {
          html, body, .kitchen-page { background: #fff !important; }
          .kitchen-page { padding: 0; min-height: 0; display: block; }
          .kitchen-paper { width: 80mm; margin: 0; }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="kitchen-paper">
        <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 700, letterSpacing: 2, margin: 0 }}>COCINA · EL RELLENITO</p>
        <p style={{ textAlign: 'center', fontSize: 44, fontWeight: 900, margin: '4px 0 0', lineHeight: 1 }}>{ticketNumber(t.number)}</p>
        <p style={{ textAlign: 'center', fontSize: 14, margin: '4px 0 0' }}>{fmtTicketDate(t.created_at)}</p>
        <hr className="k-hr" />

        <p style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{t.customer_name}</p>
        {t.kind === 'mayor' && <p style={{ fontSize: 14, fontWeight: 700, margin: '2px 0 0' }}>PEDIDO AL MAYOR</p>}
        {delivery && <p style={{ fontSize: 17, fontWeight: 800, margin: '4px 0 0' }}>{delivery.toUpperCase()}</p>}
        {when && <div className="k-row" style={{ marginTop: 4 }}><span>Entrega</span><strong>{t.meta.time ? `${when} · ${t.meta.time}` : when}</strong></div>}
        {t.meta.route && <div className="k-row"><span>Ruta</span><strong>{t.meta.route}</strong></div>}
        {t.meta.delivery_address && <div className="k-row"><span>Dir.</span><strong style={{ textAlign: 'right' }}>{t.meta.delivery_address.split('\n')[0].slice(0, 90)}</strong></div>}
        <hr className="k-hr" />

        {t.items.map((i, idx) => (
          <div key={idx} className="k-item">
            <span className="k-qty">{i.qty}×</span>
            <span>{i.name}</span>
          </div>
        ))}
        <hr className="k-hr" />
        <div className="k-row"><span>Total de unidades</span><strong>{units}</strong></div>

        {t.meta.notes && (
          <>
            <hr className="k-hr" />
            <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>NOTA</p>
            <p style={{ fontSize: 18, fontWeight: 800, margin: '2px 0 0', lineHeight: 1.25 }}>{t.meta.notes.slice(0, 200)}</p>
          </>
        )}
      </div>

      <PrintButton className="no-print" />
      {print === '1' && <AutoPrint />}
    </main>
  );
}
