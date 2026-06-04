import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { visitStore } from '@/lib/visitStore';
import { checkRateLimit, recordFailure } from '@/lib/rateLimit';
import { getClientIp } from '@/lib/getClientIp';

/**
 * Public, fire-and-forget page-visit logging for metrics.
 * No auth, no PII. Best-effort: always returns 200 so it never disrupts the UX.
 * Rate-limited per IP so a bot can't flood the visits table at scale.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    // Soft cap: count every hit as a "failure" toward the limiter so bursts get blocked.
    if (!checkRateLimit(`track:${ip}`).allowed) {
      return NextResponse.json({ ok: true, throttled: true });
    }
    recordFailure(`track:${ip}`);

    const body = await request.json().catch(() => ({})) as { path?: string; referrer?: string };
    const path = (body.path ?? '/').slice(0, 200);

    if (!supabaseAdmin) {
      visitStore.log(path);
      return NextResponse.json({ ok: true, mock: true });
    }

    await supabaseAdmin.from('page_visits').insert([{ path, referrer: body.referrer?.slice(0, 300) ?? null }]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // never fail the client
  }
}
