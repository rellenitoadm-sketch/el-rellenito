/**
 * Rastreo de rutas de los domiciliarios (estilo Strava): el teléfono del
 * domiciliario va enviando su posición GPS y se guarda el recorrido para verlo
 * en el panel admin (en vivo + historial).
 */

/** Un punto del recorrido. `t` = marca de tiempo en milisegundos (epoch). */
export interface RoutePoint {
  lat: number;
  lng: number;
  t: number;
}

const EARTH_RADIUS_M = 6371000;

/** Distancia en metros entre dos puntos (fórmula de Haversine). */
export function haversineMeters(a: RoutePoint, b: RoutePoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Longitud total (metros) de un recorrido (suma de tramos consecutivos). */
export function pathDistance(points: RoutePoint[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += haversineMeters(points[i - 1], points[i]);
  return d;
}

/** Formatea metros como "850 m" o "3.4 km". */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Pide el recorrido conduciendo POR CALLES entre dos puntos, para no dibujar una
 * recta que atraviesa las cuadras. Llama a nuestro endpoint `/api/route/directions`
 * (que consulta OpenRouteService del lado servidor, con la clave oculta). Devuelve
 * la geometría como `[lat, lng][]`, o `null` si falla (el mapa usa la recta como
 * respaldo).
 */
export async function fetchDrivingRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  signal?: AbortSignal,
): Promise<[number, number][] | null> {
  const qs = `fromLat=${from.lat}&fromLng=${from.lng}&toLat=${to.lat}&toLng=${to.lng}`;
  try {
    const res = await fetch(`/api/route/directions?${qs}`, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { line?: [number, number][] | null };
    const line = data.line;
    if (!Array.isArray(line) || line.length < 2) return null;
    return line;
  } catch {
    return null;
  }
}
