/**
 * Rutas de reparto al mayor. Las tres de siempre tienen clave fija; las nuevas
 * que crea el administrador se guardan como texto legible ("Martes y Viernes ·
 * Centro") en `wholesale_clients.route`, sin migración ni lista aparte.
 */
export interface RouteOption { value: string; label: string; area: string }

export const ROUTES: RouteOption[] = [
  { value: 'lun_jue', label: 'Lunes y Jueves', area: 'Barrancas / Puente Real' },
  { value: 'mie_sab', label: 'Miércoles y Sábado', area: 'Palo Gordo / Las Vegas' },
  { value: 'william', label: 'Ruta de William', area: 'La Concordia / Barrio Obrero / Pueblo Nuevo' },
];

export const WEEKDAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const NONE = 'Sin ruta asignada';

export function routeLabel(route: string | null): string {
  if (!route) return NONE;
  return ROUTES.find(r => r.value === route)?.label ?? route;
}

/** ["Lunes"] → "Lunes"; ["Lunes","Jueves"] → "Lunes y Jueves"; 3+ → "A, B y C". */
function joinDays(days: string[]): string {
  const ordered = WEEKDAYS.filter(d => days.includes(d));
  return ordered.length < 2 ? ordered.join('') : `${ordered.slice(0, -1).join(', ')} y ${ordered[ordered.length - 1]}`;
}

/** Texto que identifica una ruta nueva: días + zona. Vacío si no hay ninguno. */
export function buildCustomRoute(days: string[], area: string): string {
  return [joinDays(days), area.trim()].filter(Boolean).join(' · ').slice(0, 80);
}

/** Rutas disponibles al elegir: las fijas + las nuevas que ya usa algún cliente. */
export function routeOptions(clients: { route: string | null; area: string | null }[]): RouteOption[] {
  const out = [...ROUTES];
  for (const c of clients) {
    if (c.route && !out.some(o => o.value === c.route)) {
      out.push({ value: c.route, label: c.route, area: c.area ?? '' });
    }
  }
  return out;
}
