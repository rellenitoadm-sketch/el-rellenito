/**
 * Normaliza texto de un input de precio a decimal con punto.
 * Móviles en teclado numérico latino solo muestran ",", nunca ".",
 * así que el usuario no puede escribir un punto aunque quiera.
 * Acepta "," o "." como separador decimal y siempre devuelve punto.
 */
export function normalizeDecimalInput(raw: string): string {
  let v = raw.replace(',', '.');
  v = v.replace(/[^0-9.]/g, '');
  const firstDot = v.indexOf('.');
  if (firstDot !== -1) {
    v = v.slice(0, firstDot + 1) + v.slice(firstDot + 1).replace(/\./g, '');
  }
  return v;
}
