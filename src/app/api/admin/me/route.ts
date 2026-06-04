import { NextRequest, NextResponse } from 'next/server';
import { roleFromRequest } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
  const role = roleFromRequest(request);
  if (!role) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ ok: true, role });
}
