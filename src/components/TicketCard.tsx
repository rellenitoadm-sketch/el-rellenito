import {
  deliveryLabel,
  fmtCop,
  fmtTicketDate,
  fmtUsd,
  paymentLabel,
  ticketExtraUsd,
  ticketNumber,
  type Ticket,
} from '@/lib/tickets';

/**
 * Ticket de compra. Lo usan la página pública /t/<code>, la imagen PNG que se
 * manda por WhatsApp (satori) y el panel del equipo, así los tres se ven igual.
 * Por eso: todo contenedor es `display: flex`, colores en hex (sin variables
 * CSS) y un solo hijo de texto por nodo.
 */
const C = {
  brand: '#FB4D0A',
  brandDeep: '#DB3E00',
  accent: '#FFA51E',
  soft: '#FFF1E8',
  ink: '#1A1A1A',
  mute: '#6B6560',
  line: '#E6DFD7',
  paper: '#FFFFFF',
};

/** Familias para satori (imagen). En la web la página pasa las variables de next/font. */
export const IMAGE_FONTS = { serif: 'Playfair Display, Georgia, serif', sans: 'Inter, Helvetica, Arial, sans-serif' };

/** Alto aproximado en px de la imagen, para el ImageResponse (necesita alto fijo). */
export function ticketImageHeight(t: Ticket): number {
  const extras = [
    ticketExtraUsd(t) > 0,
    t.meta.delivery_address,
    t.meta.advance_usd,
    t.meta.notes,
  ].filter(Boolean).length;
  return 640 + t.items.length * 56 + extras * 46;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 15, color: strong ? C.ink : C.mute }}>
      <div style={{ display: 'flex' }}>{label}</div>
      <div style={{ display: 'flex', color: C.ink, textAlign: 'right', maxWidth: '65%' }}>{value}</div>
    </div>
  );
}

export function TicketCard({ ticket: t, logoSrc, fonts = IMAGE_FONTS }: { ticket: Ticket; logoSrc: string; fonts?: typeof IMAGE_FONTS }) {
  const SERIF = fonts.serif;
  const SANS = fonts.sans;
  const extra = ticketExtraUsd(t);
  const pay = paymentLabel(t.payment_method);
  const delivery = deliveryLabel(t.meta.delivery_type);
  const when = t.meta.date ? fmtTicketDate(t.meta.date) : '';
  const details: [string, string][] = [];
  if (when) details.push([t.kind === 'mayor' ? 'Entrega' : 'Fecha', t.meta.time ? `${when} · ${t.meta.time}` : when]);
  if (delivery) {
    // En retiro la zona viene como "Retiro en tienda": no se repite.
    const zone = t.meta.delivery_zone;
    details.push(['Modalidad', zone && zone.trim().toLowerCase() !== delivery.toLowerCase() ? `${delivery} · ${zone}` : delivery]);
  }
  if (t.meta.route) details.push(['Ruta', t.meta.route]);
  if (t.meta.delivery_address) details.push(['Dirección', t.meta.delivery_address.split('\n')[0].slice(0, 90)]);
  if (pay) details.push(['Pago', pay]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', background: C.paper, borderRadius: 28, overflow: 'hidden', fontFamily: SANS, color: C.ink }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '24px 24px', background: `linear-gradient(135deg, ${C.brand} 0%, #FF7E33 100%)`, color: '#fff' }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- también se renderiza con satori, que no entiende next/image */}
        <img src={logoSrc} width={56} height={56} alt="" style={{ borderRadius: 28, background: '#fff', flexShrink: 0 }} />
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', fontFamily: SERIF, fontSize: 26, fontWeight: 700, lineHeight: 1.1 }}>El Rellenito</div>
          <div style={{ display: 'flex', fontSize: 12, opacity: 0.9 }}>Pastelería artesanal</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
          <div style={{ display: 'flex', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.85 }}>Ticket</div>
          <div style={{ display: 'flex', fontFamily: SERIF, fontSize: 22, fontWeight: 700 }}>{ticketNumber(t.number)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '24px 24px 8px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: C.mute }}>
            {t.kind === 'mayor' ? 'Pedido al mayor para' : 'Gracias por tu compra'}
          </div>
          <div style={{ display: 'flex', fontFamily: SERIF, fontSize: 28, fontWeight: 700 }}>{t.customer_name}</div>
          <div style={{ display: 'flex', fontSize: 14, color: C.mute }}>{`Emitido el ${fmtTicketDate(t.created_at)}`}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '18px 0', borderTop: `2px dashed ${C.line}`, borderBottom: `2px dashed ${C.line}` }}>
          {t.items.map((i, idx) => (
            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, fontSize: 17 }}>
              <div style={{ display: 'flex', flex: 1 }}>{`${i.qty} × ${i.name}`}</div>
              <div style={{ display: 'flex', fontWeight: 700 }}>{fmtUsd(i.qty * i.unit_usd)}</div>
            </div>
          ))}
          {extra > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, color: C.mute }}>
              <div style={{ display: 'flex' }}>Fritura y otros cargos</div>
              <div style={{ display: 'flex' }}>{fmtUsd(extra)}</div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontSize: 14, letterSpacing: 2, textTransform: 'uppercase', color: C.mute }}>Total</div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', fontFamily: SERIF, fontSize: 44, fontWeight: 700, color: C.brandDeep }}>{fmtUsd(t.total_usd)}</div>
            {t.total_cop > 0 && <div style={{ display: 'flex', fontSize: 15, color: C.mute }}>{fmtCop(t.total_cop)}</div>}
          </div>
        </div>

        {t.meta.advance_usd ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '14px 16px', background: C.soft, borderRadius: 16 }}>
            <Row label="Abono recibido" value={fmtUsd(t.meta.advance_usd)} strong />
            <Row label="Saldo al entregar" value={fmtUsd(t.meta.remaining_usd ?? 0)} strong />
          </div>
        ) : null}

        {details.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {details.map(([k, v]) => <Row key={k} label={k} value={v} />)}
          </div>
        )}

        {t.meta.notes ? (
          <div style={{ display: 'flex', fontSize: 14, color: C.mute, fontStyle: 'italic' }}>{`Nota: ${t.meta.notes.slice(0, 140)}`}</div>
        ) : null}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '16px 24px 24px', padding: '14px 0', borderTop: `2px dashed ${C.line}`, fontSize: 14, color: C.mute }}>
        Conserva este ticket · elrellenito.com
      </div>
    </div>
  );
}
