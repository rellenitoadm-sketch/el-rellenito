/**
 * Normaliza un número telefónico al formato internacional que entiende wa.me
 * (solo dígitos, con código de país, sin el 0 inicial nacional).
 *
 * Los clientes suelen escribir el número en formato local venezolano, p. ej.
 * "0412-0688720" → "584120688720". Sin esta conversión, wa.me abre un chat
 * inválido porque le falta el código de país (58) y le sobra el 0 inicial.
 *
 * Casos cubiertos:
 *  - "00..."        → prefijo internacional: se quitan los ceros iniciales.
 *  - "0XXXXXXXXXX"  → formato nacional VE: 0 → código de país (58).
 *  - "58.." / "57.."→ ya viene con código de país: se deja igual.
 *  - "4XXXXXXXXX"   → móvil VE de 10 dígitos sin 0 → 58 + número.
 *  - "3XXXXXXXXX"   → móvil CO de 10 dígitos → 57 + número.
 *  - otro corto     → se antepone el código de país por defecto.
 *
 * Devuelve '' si no hay dígitos.
 */
export function normalizeWhatsAppNumber(
  raw: string | null | undefined,
  countryCode = '58',
): string {
  let d = (raw ?? '').replace(/\D/g, '');
  if (!d) return '';

  if (d.startsWith('00')) {
    d = d.replace(/^0+/, ''); // prefijo internacional 00…
  } else if (d.startsWith('0')) {
    d = countryCode + d.slice(1); // 0 nacional (VE) → código de país
  } else if (d.length >= 11 && (d.startsWith('58') || d.startsWith('57'))) {
    // ya trae código de país (Venezuela / Colombia): se deja igual
  } else if (d.length === 10 && d.startsWith('4')) {
    d = countryCode + d; // móvil VE sin 0 (412/414/416/424/426)
  } else if (d.length === 10 && d.startsWith('3')) {
    d = '57' + d; // móvil CO
  } else if (d.length <= 10) {
    d = countryCode + d; // fallback: número corto sin código
  }

  return d;
}
