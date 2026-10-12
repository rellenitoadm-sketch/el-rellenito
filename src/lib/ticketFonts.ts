/**
 * Fuentes de marca para la imagen del ticket (satori solo trae Geist Regular).
 * Se bajan de Google Fonts una vez por instancia; si falla, el ticket sale con
 * la fuente por defecto en vez de romperse.
 */
type Font = { name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' };

const WANTED: { family: string; css: string; weight: 400 | 700 }[] = [
  { family: 'Playfair Display', css: 'Playfair+Display:wght@700', weight: 700 },
  { family: 'Inter', css: 'Inter:wght@400', weight: 400 },
  { family: 'Inter', css: 'Inter:wght@700', weight: 700 },
];

// Sin este user-agent Google responde woff2, que satori no lee.
const TTF_UA = 'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1';

async function load(w: (typeof WANTED)[number]): Promise<Font | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${w.css}`, { headers: { 'User-Agent': TTF_UA } })).text();
    const url = css.match(/src: url\((https:[^)]+)\) format\('truetype'\)/)?.[1];
    if (!url) return null;
    return { name: w.family, data: await (await fetch(url)).arrayBuffer(), weight: w.weight, style: 'normal' };
  } catch {
    return null;
  }
}

let cached: Promise<Font[]> | null = null;

export function ticketFonts(): Promise<Font[]> {
  cached ??= Promise.all(WANTED.map(load)).then(fs => fs.filter((f): f is Font => f !== null));
  return cached;
}
