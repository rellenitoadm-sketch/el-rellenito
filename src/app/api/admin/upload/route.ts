import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { supabaseAdmin } from '@/lib/supabase';
import { isAuthorized } from '@/lib/adminAuth';

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB de entrada
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const BUCKET = 'product-images';
const MAX_DIM = 1600; // px (lado mayor)

/**
 * Image upload for product photos — staff or admin.
 * Comprime automáticamente: convierte a WebP, corrige la orientación EXIF y
 * limita el tamaño a 1600px → fotos mucho más livianas en storage y al servir.
 * Los GIF se dejan tal cual para preservar la animación. Si Supabase no está
 * configurado (modo mock) devuelve un data URL (ya comprimido).
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

  const original = Buffer.from(await file.arrayBuffer());

  // Compresión automática (excepto GIF, para no perder la animación).
  let outBytes: Buffer = original;
  let outType = file.type;
  let outExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  if (file.type !== 'image/gif') {
    try {
      outBytes = await sharp(original)
        .rotate() // respeta la orientación EXIF
        .resize({ width: MAX_DIM, height: MAX_DIM, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
      outType = 'image/webp';
      outExt = 'webp';
    } catch {
      // Si sharp no puede procesarla, se sube el original sin comprimir.
    }
  }

  if (!supabaseAdmin) {
    // Modo mock — devuelve un data URL (funciona en dev, sin storage).
    const dataUrl = `data:${outType};base64,${outBytes.toString('base64')}`;
    return NextResponse.json({ url: dataUrl, mock: true });
  }

  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${outExt}`;

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, outBytes, { contentType: outType, upsert: false });

  if (error) {
    return NextResponse.json(
      { error: `No se pudo subir la imagen: ${error.message}. ¿Creaste el bucket público "${BUCKET}"?` },
      { status: 500 },
    );
  }

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, optimized: outType === 'image/webp' });
}
