import { deliveryLabel, fmtCop, fmtTicketDate, fmtUsd, paymentLabel, ticketExtraUsd, ticketNumber, type Ticket } from '@/lib/tickets';

/**
 * Versión del ticket para la impresora térmica de 80 mm (la comanda de cocina).
 * Es el MISMO ticket que ve el cliente: solo negro sobre blanco y con letra grande.
 * En pantalla está oculto; aparece solo al imprimir (ver la página /t/<code>).
 */
export function TicketSlip({ ticket: t }: { ticket: Ticket }) {
  const delivery = deliveryLabel(t.meta.delivery_type);
  const when = t.meta.date ? fmtTicketDate(t.meta.date) : '';
  const pay = paymentLabel(t.payment_method);
  const extra = ticketExtraUsd(t);
  const units = t.items.reduce((s, i) => s + i.qty, 0);

  return (
    <div className="ticket-slip">
      <p className="s-center s-small s-bold" style={{ letterSpacing: 2 }}>EL RELLENITO</p>
      <p className="s-center s-num">{ticketNumber(t.number)}</p>
      <p className="s-center s-small">{fmtTicketDate(t.created_at)}</p>
      <hr />

      <p className="s-big s-bold">{t.customer_name}</p>
      {t.customer_phone && <p className="s-small">{t.customer_phone}</p>}
      {t.kind === 'mayor' && <p className="s-bold">PEDIDO AL MAYOR</p>}
      {delivery && <p className="s-big s-bold">{delivery.toUpperCase()}</p>}
      {when && <p className="s-row"><span>Entrega</span><b>{t.meta.time ? `${when} · ${t.meta.time}` : when}</b></p>}
      {t.meta.route && <p className="s-row"><span>Ruta</span><b>{t.meta.route}</b></p>}
      {t.meta.delivery_address && <p className="s-row"><span>Dir.</span><b>{t.meta.delivery_address.split('\n')[0].slice(0, 90)}</b></p>}
      <hr />

      {t.items.map((i, idx) => (
        <div key={idx} className="s-item">
          <span className="s-qty">{i.qty}×</span>
          <span className="s-name">{i.name}</span>
          <span className="s-price">{fmtUsd(i.qty * i.unit_usd)}</span>
        </div>
      ))}
      {extra > 0 && <p className="s-row"><span>Fritura y otros cargos</span><b>{fmtUsd(extra)}</b></p>}
      <hr />

      <p className="s-row"><span>Unidades</span><b>{units}</b></p>
      <p className="s-row s-big s-bold"><span>TOTAL</span><span>{fmtUsd(t.total_usd)}</span></p>
      {t.total_cop > 0 && <p className="s-row s-small"><span /><span>{fmtCop(t.total_cop)}</span></p>}
      {pay && <p className="s-row"><span>Pago</span><b>{pay}</b></p>}
      {t.meta.advance_usd ? (
        <>
          <p className="s-row"><span>Abono</span><b>{fmtUsd(t.meta.advance_usd)}</b></p>
          <p className="s-row s-bold"><span>Saldo al entregar</span><span>{fmtUsd(t.meta.remaining_usd ?? 0)}</span></p>
        </>
      ) : null}

      {t.meta.notes && (
        <>
          <hr />
          <p className="s-small s-bold">NOTA</p>
          <p className="s-note">{t.meta.notes.slice(0, 200)}</p>
        </>
      )}
    </div>
  );
}

/** Estilos del ticket para 80 mm: oculto en pantalla; al imprimir es lo único que sale. */
export const SLIP_CSS = `
  .ticket-slip { display: none; }
  @media print {
    @page { size: 80mm auto; margin: 0; }
    html, body { background: #fff !important; margin: 0 !important; }
    main { padding: 0 !important; margin: 0 !important; min-height: 0 !important; max-width: none !important; background: #fff !important; display: block !important; }
    main > *:not(.ticket-slip) { display: none !important; }
    .ticket-slip * { color: #000 !important; }
    .ticket-slip { display: block; width: 80mm; box-sizing: border-box; padding: 4mm 4mm 10mm; background: #fff; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.3; }
    .ticket-slip p { margin: 2px 0; }
    .ticket-slip hr { border: 0; border-top: 2px dashed #000; margin: 8px 0; }
    .ticket-slip .s-center { text-align: center; }
    .ticket-slip .s-small { font-size: 12px; }
    .ticket-slip .s-bold { font-weight: 800; }
    .ticket-slip .s-big { font-size: 20px; }
    .ticket-slip .s-num { text-align: center; font-size: 44px; font-weight: 900; line-height: 1; margin: 4px 0; }
    .ticket-slip .s-row { display: flex; justify-content: space-between; gap: 8px; }
    .ticket-slip .s-row b { text-align: right; }
    .ticket-slip .s-item { display: flex; gap: 8px; align-items: baseline; padding: 3px 0; font-weight: 800; }
    .ticket-slip .s-qty { font-size: 28px; min-width: 2.1em; }
    .ticket-slip .s-name { flex: 1; font-size: 20px; line-height: 1.15; }
    .ticket-slip .s-price { font-size: 13px; font-weight: 600; }
    .ticket-slip .s-note { font-size: 18px; font-weight: 800; line-height: 1.25; }
  }
`;
