/** Rutas de reparto al mayor: clave guardada → etiqueta y zona que muestra el panel. */
export const ROUTES: { value: string; label: string; area: string }[] = [
  { value: 'lun_jue', label: 'Lunes y Jueves', area: 'Barrancas / Puente Real' },
  { value: 'mie_sab', label: 'Miércoles y Sábado', area: 'Palo Gordo / Las Vegas' },
  { value: 'william', label: 'Ruta de William', area: 'La Concordia / Barrio Obrero / Pueblo Nuevo' },
];

export function routeLabel(route: string | null): string {
  return ROUTES.find(r => r.value === route)?.label ?? 'Sin ruta asignada';
}
