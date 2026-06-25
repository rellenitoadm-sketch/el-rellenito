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
