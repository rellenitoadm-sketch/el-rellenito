import { deliveryZones, STORE_COORDS, MAX_COVERAGE_KM, type DeliveryZone } from './zones';

/** Distancia entre dos puntos (km) — fórmula de Haversine. */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface CoordZoneResult {
  zone: DeliveryZone;
  distanceFromStoreKm: number;
  outOfCoverage: boolean;
}

/**
 * Determina la zona REAL del cliente a partir de sus coordenadas GPS:
 * asigna la zona cuyo centro está más cerca del cliente. Esto evita que
 * el cliente elija una zona más barata que la que realmente le corresponde.
 */
export function detectZoneFromCoords(lat: number, lng: number): CoordZoneResult | null {
  const candidates = deliveryZones.filter(
    z => z.id !== 'retiro' && z.lat != null && z.lng != null
  );
  if (candidates.length === 0) return null;

  let nearest: DeliveryZone | null = null;
  let nearestDist = Infinity;
  for (const z of candidates) {
    const d = haversineKm(lat, lng, z.lat as number, z.lng as number);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = z;
    }
  }
  if (!nearest) return null;

  const distanceFromStoreKm = haversineKm(lat, lng, STORE_COORDS.lat, STORE_COORDS.lng);
  return {
    zone: nearest,
    distanceFromStoreKm,
    outOfCoverage: distanceFromStoreKm > MAX_COVERAGE_KM,
  };
}

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=es`,
    { headers: { 'User-Agent': 'ElRellenito/1.0' } }
  );
  if (!res.ok) throw new Error('Nominatim error');
  const data = await res.json();
  return (data.display_name as string) ?? '';
}
