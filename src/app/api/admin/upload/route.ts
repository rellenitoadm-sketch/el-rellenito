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

  // Se lee el body como bytes crudos (no FormData/multipart): el parsing de
  // multipart en producción corrompía el binario (bytes no-UTF8 reemplazados
  // por U+FFFD antes de llegar a sharp). El cliente manda el archivo directo
  // como body con Content-Type: image/* y el nombre en X-File-Name.
  const fileType = request.headers.get('content-type') ?? '';
  const fileName = request.headers.get('x-file-name') ?? 'upload.jpg';

  if (!ALLOWED.includes(fileType)) {
    return NextResponse.json({ error: 'Formato no permitido (usa JPG, PNG, WEBP o GIF)' }, { status: 400 });
  }

  const original = Buffer.from(await request.arrayBuffer());
  if (original.length === 0) {
    return NextResponse.json({ error: 'No se recibió ninguna imagen' }, { status: 400 });
  }
  if (original.length > MAX_BYTES) {
    return NextResponse.json({ error: 'La imagen supera 4 MB' }, { status: 400 });
  }

  // Compresión automática (excepto GIF, para no perder la animación).
  let outBytes: Buffer = original;
  let outType = fileType;
  let outExt = fileName.split('.').pop()?.toLowerCase() || 'jpg';
  if (fileType !== 'image/gif') {
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
