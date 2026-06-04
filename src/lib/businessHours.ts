/**
 * Single source of truth for business operating hours.
 * Used by Header (open/closed chip), WholesaleDatePicker (disable closed days),
 * Footer, and anywhere else that needs to reflect when the store is open.
 */

const TIMEZONE = 'America/Caracas'; // UTC-4, no DST

export interface DayHours {
  open: number;   // 24h decimal (8 = 8:00, 8.5 = 8:30)
  close: number;
}

// El Rellenito: Lunes a Sábado 8 AM – 7 PM. Domingo cerrado.
// 0=Sun, 1=Mon, ..., 6=Sat
export const BUSINESS_HOURS: Record<number, DayHours | null> = {
  0: null,
  1: { open: 8, close: 19 },
  2: { open: 8, close: 19 },
  3: { open: 8, close: 19 },
  4: { open: 8, close: 19 },
  5: { open: 8, close: 19 },
  6: { open: 8, close: 19 },
};

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const WEEKDAY_TO_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export interface OpenStatus {
  open: boolean;
  label: string;
}

function formatHour(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  const period = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return mm === 0 ? `${h12} ${period}` : `${h12}:${String(mm).padStart(2, '0')} ${period}`;
}

/** Get day + hours in the business timezone, regardless of host TZ. */
function nowInBusinessTZ(now: Date): { day: number; hours: number } {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const wd = parts.find(p => p.type === 'weekday')?.value ?? 'Mon';
    const hh = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10);
    const mm = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10);
    return { day: WEEKDAY_TO_INDEX[wd] ?? now.getDay(), hours: hh + mm / 60 };
  } catch {
    return { day: now.getDay(), hours: now.getHours() + now.getMinutes() / 60 };
  }
}

function nextOpenDay(fromDay: number): { dayName: string; daysAway: number; hours: DayHours } | null {
  for (let i = 1; i <= 7; i++) {
    const d = (fromDay + i) % 7;
    const h = BUSINESS_HOURS[d];
    if (h) return { dayName: DAY_NAMES[d], daysAway: i, hours: h };
  }
  return null;
}

export function getOpenStatus(now: Date = new Date()): OpenStatus {
  const { day, hours } = nowInBusinessTZ(now);
  const today = BUSINESS_HOURS[day];

  if (today && hours >= today.open && hours < today.close) {
    return { open: true, label: `Abierto · Hasta las ${formatHour(today.close)}` };
  }
  if (today && hours < today.open) {
    return { open: false, label: `Abre hoy a las ${formatHour(today.open)}` };
  }
  // After today's close OR today is fully closed → find next open day
  const next = nextOpenDay(day);
  if (!next) return { open: false, label: 'Cerrado' };
  if (next.daysAway === 1) {
    return { open: false, label: `Cerrado · Abre mañana ${formatHour(next.hours.open)}` };
  }
  return { open: false, label: `Cerrado · Abre ${next.dayName} ${formatHour(next.hours.open)}` };
}

/** True if the given calendar day (per BUSINESS_HOURS keying) is a closed day. */
export function isClosedDay(date: Date): boolean {
  return BUSINESS_HOURS[date.getDay()] === null;
}
