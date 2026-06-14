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

/**
 * Estimado de envío (NO vinculante). El envío no se suma al pedido: solo se le
 * muestra al cliente un rango de lo que podría costar para no comprometer un
 * monto exacto. El monto real se confirma por WhatsApp al coordinar la entrega.
 */
export interface DeliveryEstimate {
  /** Sector más probable (zona GPS más cercana, o la elegida a mano). null si no se infiere. */
  primaryZone: DeliveryZone | null;
  /** Rango estimado en COP — referencia para el cliente y el staff, no se cobra. */
  minCop: number;
  maxCop: number;
  distanceFromStoreKm?: number;
  outOfCoverage: boolean;
}

const activePaidZones = (): DeliveryZone[] =>
  deliveryZones.filter(z => z.id !== 'retiro' && z.active);

/** Rango global de envío (zona más barata → más cara entre las activas). */
export function globalDeliveryRange(): { minCop: number; maxCop: number } {
  const costs = activePaidZones().map(z => z.cost_cop);
  if (costs.length === 0) return { minCop: 0, maxCop: 0 };
  return { minCop: Math.min(...costs), maxCop: Math.max(...costs) };
}

/**
 * Estima el envío por GPS. El sector más probable es la zona cuyo centro está
 * más cerca; el rango abarca las DOS zonas más cercanas, de modo que los
 * sectores aledaños a una zona heredan su precio (rango no vinculante).
 */
export function estimateFromCoords(lat: number, lng: number): DeliveryEstimate {
  const ranked = activePaidZones()
    .filter(z => z.lat != null && z.lng != null)
    .map(z => ({ z, d: haversineKm(lat, lng, z.lat as number, z.lng as number) }))
    .sort((a, b) => a.d - b.d);

  const distanceFromStoreKm = haversineKm(lat, lng, STORE_COORDS.lat, STORE_COORDS.lng);
  const outOfCoverage = distanceFromStoreKm > MAX_COVERAGE_KM;

  if (ranked.length === 0) {
    return { primaryZone: null, ...globalDeliveryRange(), distanceFromStoreKm, outOfCoverage };
  }
  const nearest = ranked[0].z;
  const second = (ranked[1] ?? ranked[0]).z;
  return {
    primaryZone: nearest,
    minCop: Math.min(nearest.cost_cop, second.cost_cop),
    maxCop: Math.max(nearest.cost_cop, second.cost_cop),
    distanceFromStoreKm,
    outOfCoverage,
  };
}

/**
 * Estima el envío a partir del sector elegido a mano (modo dirección por texto):
 * abarca el costo del sector y el de la franja de precio vecina, para no
 * comprometer un monto exacto.
 */
export function estimateForZone(zoneId: string): DeliveryEstimate {
  const byCost = activePaidZones().slice().sort((a, b) => a.cost_cop - b.cost_cop);
  const idx = byCost.findIndex(z => z.id === zoneId);
  if (idx === -1) {
    return { primaryZone: null, ...globalDeliveryRange(), outOfCoverage: false };
  }
  const lo = byCost[Math.max(0, idx - 1)];
  const hi = byCost[Math.min(byCost.length - 1, idx + 1)];
  return {
    primaryZone: byCost[idx],
    minCop: Math.min(lo.cost_cop, hi.cost_cop),
    maxCop: Math.max(lo.cost_cop, hi.cost_cop),
    outOfCoverage: false,
  };
}
