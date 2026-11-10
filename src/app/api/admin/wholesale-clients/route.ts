import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { requireRole } from '@/lib/adminAuth';

export interface WholesaleClient {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  route: string | null;
  area: string | null;
  notes: string | null;
  masa_prices: Record<string, { usd: number | null; cop: number | null }>;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Listado de la cartera de clientes al mayor. Admin: todo. Equipo: sin `notes`
 * (ahí van acuerdos internos), pero SÍ `masa_prices` — es el precio de masas
 * que el domiciliario mismo acuerda y necesita ver/editar al registrar pedidos.
 */
export async function GET(request: NextRequest) {
  const role = requireRole(request, 'admin', 'staff');
  if (!role) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!supabaseAdmin) return NextResponse.json([]);

  const columns = role === 'admin' ? '*' : 'id, name, phone, address, route, area, active, masa_prices';
  const { data, error } = await supabaseAdmin
    .from('wholesale_clients')
    .select(columns)
    .order('route', { ascending: true })
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

/**
 * Crear un cliente al mayor. Admin: todos los campos. Equipo: también puede
 * registrar uno nuevo al tomar un pedido (mayorista que todavía no estaba en
 * la cartera) — sin `notes` (acuerdos internos, solo admin) ni desactivarlo.
 */
export async function POST(request: NextRequest) {
  const role = requireRole(request, 'admin', 'staff');
  if (!role) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as Partial<WholesaleClient>;
  const name = (body.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 });

  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Base de datos no disponible' }, { status: 503 });
  }

  const insert = {
    name,
    phone: body.phone?.trim() || null,
    address: body.address?.trim() || null,
    route: body.route?.trim().slice(0, 80) || null,
    area: body.area?.trim().slice(0, 80) || null,
    ...(role === 'admin' ? { notes: body.notes?.trim() || null, active: body.active ?? true } : { active: true }),
  };

  const { data, error } = await supabaseAdmin
    .from('wholesale_clients')
    .insert([insert])
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
