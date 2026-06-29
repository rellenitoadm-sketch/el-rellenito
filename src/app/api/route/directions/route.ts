import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/adminAuth';

/**
 * Proxy a OpenRouteService: devuelve el recorrido conduciendo POR CALLES entre
 * dos puntos como `{ line: [lat, lng][] }`. La clave (ORS_API_KEY) vive solo en
 * el servidor, nunca llega al navegador. Si falta la clave o ORS falla, responde
 * `{ line: null }` y el mapa cae a la línea recta como respaldo.
 */
export async function GET(request: NextRequest) {
  if (!requireRole(request, 'admin', 'staff')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const key = process.env.ORS_API_KEY;
  if (!key) return NextResponse.json({ line: null });

  const sp = request.nextUrl.searchParams;
  const fromLat = Number(sp.get('fromLat'));
  const fromLng = Number(sp.get('fromLng'));
  const toLat = Number(sp.get('toLat'));
  const toLng = Number(sp.get('toLng'));
  if (![fromLat, fromLng, toLat, toLng].every(Number.isFinite)) {
    return NextResponse.json({ error: 'Coordenadas inválidas' }, { status: 400 });
  }

  try {
    // ORS usa orden lng,lat. La clave va en el header (no en la URL) para evitar
    // problemas de codificación con los caracteres del token.
    const res = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
      method: 'POST',
      headers: { Authorization: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ coordinates: [[fromLng, fromLat], [toLng, toLat]] }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return NextResponse.json({ line: null });
    const data = (await res.json()) as {
      features?: { geometry?: { coordinates?: [number, number][] } }[];
    };
    const coords = data.features?.[0]?.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return NextResponse.json({ line: null });
    // GeoJSON [lng, lat] → Leaflet [lat, lng].
    return NextResponse.json({ line: coords.map(([lng, lat]) => [lat, lng] as [number, number]) });
  } catch {
    return NextResponse.json({ line: null });
  }
}
