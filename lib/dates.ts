// Calendar days ("YYYY-MM-DD", the Postgres `date` format) in the store's
// time zone. Fixed to Brasília, not the device's: part of the admin renders
// on the server, which runs in UTC (same rule as lib/admin/banners.ts).

const STORE_TIME_ZONE = "America/Sao_Paulo";
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const isoDay = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: STORE_TIME_ZONE,
});

/** Today in Brasília, "YYYY-MM-DD". */
export function storeToday(now = new Date()): string {
  return isoDay.format(now);
}

export function isDay(value: string | null | undefined): value is string {
  return !!value && DAY.test(value);
}

/** "2026-10-20" → "20/10/2026". */
export function formatDay(day: string): string {
  const match = day.match(DAY);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : day;
}

/** "2026-10-20" → "20/10". */
export function formatShortDay(day: string): string {
  const match = day.match(DAY);
  return match ? `${match[3]}/${match[2]}` : day;
}

const utc = (day: string) => {
  const [, y, m, d] = day.match(DAY)!;
  return Date.UTC(Number(y), Number(m) - 1, Number(d));
};

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  return Math.round((utc(to) - utc(from)) / DAY_MS);
}

/** "2026-10-20" + 3 → "2026-10-23". */
export function addDays(day: string, days: number): string {
  return new Date(utc(day) + days * DAY_MS).toISOString().slice(0, 10);
}
