/**
 * Foto de producto con el fondo de la marca, en el navegador (sin costo por foto):
 * quita el fondo con @imgly/background-removal y pone el producto sobre el degradado
 * crema/durazno de las demás fotos del catálogo, con una sombra suave debajo.
 * La primera vez descarga el modelo (~40 MB) y luego queda en caché del navegador.
 */
const SIZE = 1200;
const FILL = 0.8; // el producto ocupa hasta el 80 % del lado

function loadBitmap(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob, { imageOrientation: 'from-image' });
}

/** Recorta el área con píxeles visibles (alfa > 20) para centrar el producto. */
function contentBox(img: ImageBitmap): { x: number; y: number; w: number; h: number } {
  const max = 400;
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.width * k));
  c.height = Math.max(1, Math.round(img.height * k));
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const { data } = ctx.getImageData(0, 0, c.width, c.height);
  let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
  for (let y = 0; y < c.height; y++) {
    for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 20) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w: img.width, h: img.height };
  return { x: minX / k, y: minY / k, w: (maxX - minX + 1) / k, h: (maxY - minY + 1) / k };
}

export async function withBrandBackground(file: File): Promise<File> {
  const { removeBackground } = await import('@imgly/background-removal');
  const cutout = await removeBackground(file, { output: { format: 'image/png' } });
  const img = await loadBitmap(cutout);
  const box = contentBox(img);

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  // Fondo: crema con durazno suave arriba a la derecha.
  const base = ctx.createLinearGradient(0, SIZE, SIZE, 0);
  base.addColorStop(0, '#FBF3E6');
  base.addColorStop(0.55, '#FBEBDD');
  base.addColorStop(1, '#F8C4A8');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, SIZE, SIZE);

  const scale = Math.min((SIZE * FILL) / box.w, (SIZE * FILL) / box.h);
  const dw = box.w * scale;
  const dh = box.h * scale;
  const dx = (SIZE - dw) / 2;
  const dy = (SIZE - dh) / 2 + SIZE * 0.02;

  // Sombra de contacto debajo del producto.
  ctx.save();
  ctx.filter = 'blur(18px)';
  ctx.fillStyle = 'rgba(90, 50, 20, 0.28)';
  ctx.beginPath();
  ctx.ellipse(SIZE / 2, dy + dh - dh * 0.02, dw * 0.42, dh * 0.07, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.drawImage(img, box.x, box.y, box.w, box.h, dx, dy, dw, dh);
  img.close();

  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.9));
  if (!blob) throw new Error('No se pudo armar la foto');
  return new File([blob], `${file.name.replace(/\.\w+$/, '')}.jpg`, { type: 'image/jpeg' });
}
