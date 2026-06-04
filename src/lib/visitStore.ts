/**
 * In-memory page-visit store — mock mode (dev / no Supabase yet).
 * Module-level → shared across requests in the same process.
 */

export type Visit = { created_at: string; path: string; hour: number; date: string };

const visits: Visit[] = [];

export const visitStore = {
  log(path: string) {
    const now = new Date();
    // America/Caracas is UTC-4 (no DST)
    const caracas = new Date(now.getTime() - 4 * 60 * 60 * 1000);
    visits.push({
      created_at: now.toISOString(),
      path,
      hour: caracas.getUTCHours(),
      date: caracas.toISOString().slice(0, 10),
    });
    if (visits.length > 5000) visits.shift();
  },
  getAll(): Visit[] {
    return visits;
  },
};
