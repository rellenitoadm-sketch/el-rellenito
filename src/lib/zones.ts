export interface DeliveryZone {
  id: string;
  name: string;
  neighborhoods: string;
  cost_cop: number;
  cost_usd: number; // referencia — se recalcula con tasa actual
  active: boolean;
  /** Centro aproximado de la zona (para detección por GPS). */
  lat?: number;
  lng?: number;
}

/**
 * Ubicación de la tienda (La Concordia, San Cristóbal — Táchira).
 * Coordenadas aproximadas; el cliente puede afinarlas.
 */
export const STORE_COORDS = { lat: 7.7436, lng: -72.2275 };

/** Radio de cobertura habitual desde la tienda (km). Fuera de esto se confirma manual. */
export const MAX_COVERAGE_KM = 12;

export const deliveryZones: DeliveryZone[] = [
  {
    id: 'retiro',
    name: 'Retiro en tienda',
    neighborhoods: 'La Concordia — sede El Rellenito',
    cost_cop: 0,
    cost_usd: 0,
    active: true,
  },
  {
    id: 'la-concordia',
    name: 'La Concordia',
    neighborhoods: 'La Concordia y sectores aledaños',
    cost_cop: 4000,
    cost_usd: 0.95,
    active: true,
    lat: 7.7460,
    lng: -72.2270,
  },
  {
    id: 'centro-catedral',
    name: 'Centro / Catedral',
    neighborhoods: 'Centro, Barrio Obrero, Las Flores, 23 de Enero, Catedral',
    cost_cop: 8000,
    cost_usd: 1.90,
    active: true,
    lat: 7.7669,
    lng: -72.2247,
  },
  {
    id: 'pueblo-nuevo',
    name: 'Pueblo Nuevo',
    neighborhoods: 'Pueblo Nuevo y sectores aledaños',
    cost_cop: 10000,
    cost_usd: 2.38,
    active: true,
    lat: 7.7795,
    lng: -72.2165,
  },
  {
    id: 'tariba-pirineos',
    name: 'Tariba / Pirineos',
    neighborhoods: 'Tariba, Pirineos, San Carlos',
    cost_cop: 13000,
    cost_usd: 3.09,
    active: true,
    lat: 7.8140,
    lng: -72.2210,
  },
];

export const wholesaleZone: DeliveryZone = {
  id: 'al-mayor',
  name: 'Entrega Al Mayor',
  neighborhoods: 'Ruta definida por días (consultar)',
  cost_cop: 0,
  cost_usd: 0,
  active: true,
};
