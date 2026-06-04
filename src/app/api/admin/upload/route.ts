import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthorized } from '@/lib/adminAuth';

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const BUCKET = 'product-images';

/**
 * Image upload for product photos — staff or admin.
 * With Supabase configured: uploads to the `product-images` storage bucket and
 * returns its public URL. Without it (mock mode): returns a base64 data URL so
 * the panel still works end-to-end in dev.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No se recibió ninguna imagen' }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: 'Formato no permitido (usa JPG, PNG, WEBP o GIF)' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'La imagen supera 4 MB' }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  if (!supabaseAdmin) {
    // Mock mode — return a data URL (works in dev, no storage needed).
    const dataUrl = `data:${file.type};base64,${bytes.toString('base64')}`;
    return NextResponse.json({ url: dataUrl, mock: true });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false });

  if (error) {
    return NextResponse.json(
      { error: `No se pudo subir la imagen: ${error.message}. ¿Creaste el bucket público "${BUCKET}"?` },
      { status: 500 },
    );
  }

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
