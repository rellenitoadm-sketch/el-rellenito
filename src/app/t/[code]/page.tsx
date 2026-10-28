import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { fmtUsd, isTicketCode, ticketNumber } from '@/lib/tickets';
import { getTicketByCode } from '@/lib/tickets.server';
import { TicketCard } from '@/components/TicketCard';
import { TicketSlip, SLIP_CSS } from '@/components/TicketSlip';
import { AutoPrint, TicketActions } from '@/components/TicketActions';

const WEB_FONTS = { serif: 'var(--font-playfair), Georgia, serif', sans: 'var(--font-inter), Helvetica, sans-serif' };

type Props = { params: Promise<{ code: string }>; searchParams: Promise<{ print?: string }> };

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

export default async function TicketPage({ params, searchParams }: Props) {
  const { code } = await params;
  const { print } = await searchParams;
  const ticket = await load(code);
  if (!ticket) notFound();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center gap-4 px-4 py-8" style={{ background: '#FFE9DC' }}>
      <style>{SLIP_CSS}</style>
      <TicketCard ticket={ticket} logoSrc="/logo-circle.png" fonts={WEB_FONTS} />
      <TicketSlip ticket={ticket} />
      <TicketActions code={code} number={ticket.number} inline />
      {print === '1' && <AutoPrint />}
    </main>
  );
}
