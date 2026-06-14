// Genera los iconos PWA (192, 512, apple-touch) a partir del logo,
// centrados sobre un fondo de marca para que se vean bien como app.
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const pub = path.join(__dirname, '..', 'public');
const src = path.join(pub, 'logo-circle.png');
const BRAND = '#FF5100';

async function gen(size, out, padding) {
  const inner = Math.round(size * (1 - padding * 2));
  const logo = await sharp(src)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BRAND },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(path.join(pub, out));
  console.log('  ✓', out, `(${size}x${size})`);
}

(async () => {
  if (!fs.existsSync(src)) { console.error('No existe', src); process.exit(1); }
  console.log('Generando iconos PWA…');
  await gen(192, 'icon-192.png', 0.14);
  await gen(512, 'icon-512.png', 0.14);
  await gen(180, 'apple-touch-icon.png', 0.12);
  console.log('Listo.');
})().catch(e => { console.error(e); process.exit(1); });
