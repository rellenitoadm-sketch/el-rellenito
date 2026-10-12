import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { fmtUsd, isTicketCode, ticketNumber } from '@/lib/tickets';
import { getTicketByCode } from '@/lib/tickets.server';
import { TicketCard } from '@/components/TicketCard';
import { PrintButton } from './PrintButton';

const WEB_FONTS = { serif: 'var(--font-playfair), Georgia, serif', sans: 'var(--font-inter), Helvetica, sans-serif' };

type Props = { params: Promise<{ code: string }> };

async function load(code: string) {
  if (!supabaseAdmin || !isTicketCode(code)) return null;
  return getTicketByCode(supabaseAdmin, code);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const t = await load(code);
  if (!t) return { title: 'Ticket no encontrado', robots: { index: false } };
  return {
    title: `Ticket ${ticketNumber(t.number)} · El Rellenito`,
    description: `Ticket de ${t.customer_name} por ${fmtUsd(t.total_usd)}`,
    robots: { index: false, follow: false },
    openGraph: { images: [`/t/${code}/image`] },
  };
}

export default async function TicketPage({ params }: Props) {
  const { code } = await params;
  const ticket = await load(code);
  if (!ticket) notFound();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center gap-4 px-4 py-8" style={{ background: '#FFE9DC' }}>
      <TicketCard ticket={ticket} logoSrc="/logo-circle.png" fonts={WEB_FONTS} />
      <div className="flex w-full gap-3 print:hidden">
        <PrintButton />
        <a className="btn btn-secondary flex-1 justify-center" href={`/t/${code}/image`} download={`ticket-${ticket.number}.png`}>
          Descargar imagen
        </a>
      </div>
    </main>
  );
}
