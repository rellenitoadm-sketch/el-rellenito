import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { supabaseAdmin } from '@/lib/supabase';
import { isTicketCode } from '@/lib/tickets';
import { getTicketByCode } from '@/lib/tickets.server';
import { ticketFonts } from '@/lib/ticketFonts';
import { TicketCard, ticketImageHeight } from '@/components/TicketCard';

const WIDTH = 640;

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

  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', padding: 24, background: '#FFE9DC' }}>
        <TicketCard ticket={ticket} logoSrc={`data:image/png;base64,${logo.toString('base64')}`} />
      </div>
    ),
    {
      width: WIDTH,
      height: ticketImageHeight(ticket),
      fonts,
      headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
    },
  );
}
