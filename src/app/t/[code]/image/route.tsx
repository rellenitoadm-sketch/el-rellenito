import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { supabaseAdmin } from '@/lib/supabase';
import { isTicketCode } from '@/lib/tickets';
import { getTicketByCode } from '@/lib/tickets.server';
import { ticketFonts } from '@/lib/ticketFonts';
import { TicketCard, ticketImageHeight } from '@/components/TicketCard';

const WIDTH = 640;
/** La imagen se dibuja al doble de tamaño (1280 px de ancho) para que salga nítida al imprimir. */
const SCALE = 2;

/** PNG del ticket: es lo que el equipo reenvía por WhatsApp y la vista previa del link. */
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!supabaseAdmin || !isTicketCode(code)) return new Response('No encontrado', { status: 404 });
  const ticket = await getTicketByCode(supabaseAdmin, code);
  if (!ticket) return new Response('No encontrado', { status: 404 });

  const [logo, fonts] = await Promise.all([
    readFile(path.join(process.cwd(), 'public', 'logo-circle.png')),
    ticketFonts(),
  ]);

  const height = ticketImageHeight(ticket);

  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', background: '#FFE9DC' }}>
        <div style={{ display: 'flex', width: WIDTH, height, padding: 24, transform: `scale(${SCALE})`, transformOrigin: 'top left' }}>
          <TicketCard ticket={ticket} logoSrc={`data:image/png;base64,${logo.toString('base64')}`} />
        </div>
      </div>
    ),
    {
      width: WIDTH * SCALE,
      height: height * SCALE,
      fonts,
      headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
    },
  );
}
