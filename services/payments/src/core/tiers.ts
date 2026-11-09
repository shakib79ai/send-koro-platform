/**
 * Subscription tiers — brief §"Subscription billing rules".
 * Tier base = previous calendar month (America/New_York) food subtotal after food discounts
 * minus food refunds processed in that month. Excludes delivery, subsidies, tax, tips, fees.
 *
 * Thresholds below come from the Send Koro admin "Plans & billing" design. They are business
 * decisions — confirm them before launch (brief: "no thresholds are invented in this specification").
 */
export interface Tier { lookupKey: string; upToCents: number | null; priceCents: number; label: string }

export const RESTAURANT_TIER_RULE_VERSION = 'restaurant-2026-11-v1';
export const RESTAURANT_TIERS: Tier[] = [
  { lookupKey: 'sk_restaurant_tier_050', upToCents: 2_500_00, priceCents: 50_00, label: 'Up to $2,500' },
  { lookupKey: 'sk_restaurant_tier_100', upToCents: 5_000_00, priceCents: 100_00, label: '$2,500.01 – $5,000' },
  { lookupKey: 'sk_restaurant_tier_150', upToCents: 7_500_00, priceCents: 150_00, label: '$5,000.01 – $7,500' },
  { lookupKey: 'sk_restaurant_tier_250', upToCents: 10_000_00, priceCents: 250_00, label: '$7,500.01 – $10,000' },
  { lookupKey: 'sk_restaurant_tier_350', upToCents: 15_000_00, priceCents: 350_00, label: '$10,000.01 – $15,000' },
  { lookupKey: 'sk_restaurant_tier_500', upToCents: null, priceCents: 500_00, label: 'More than $15,000' },
];

/** Negative bases (more refunds than sales) and zero sales use the lowest tier. */
export function selectTier(baseCents: number, tiers: Tier[] = RESTAURANT_TIERS): Tier {
  const base = Math.max(0, baseCents);
  return tiers.find((t) => t.upToCents === null || base <= t.upToCents)!;
}

/** UTC offset (minutes) of a zone at an instant, using Intl only. */
function offsetMinutes(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' }).formatToParts(at);
  const tz = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const m = tz.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!m) return 0;
  const sign = m[1] === '-' ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

/** Instant of a local wall-clock time on the given date in a zone (DST-safe). */
export function zonedTime(year: number, month1: number, day: number, hour = 0, timeZone = 'America/New_York'): Date {
  const guess = new Date(Date.UTC(year, month1 - 1, day, hour, 0, 0));
  const off1 = offsetMinutes(guess, timeZone);
  const t = new Date(guess.getTime() - off1 * 60_000);
  const off2 = offsetMinutes(t, timeZone);
  return off1 === off2 ? t : new Date(guess.getTime() - off2 * 60_000);
}

export const zonedMidnight = (year: number, month1: number, day: number, timeZone = 'America/New_York') => zonedTime(year, month1, day, 0, timeZone);

/** [start, end) of a calendar month in America/New_York. period = 'YYYY-MM'. */
export function monthBounds(period: string, timeZone = 'America/New_York'): { start: Date; end: Date } {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) throw new Error(`Bad period ${period}`);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return { start: zonedMidnight(y, m, 1, timeZone), end: zonedMidnight(ny, nm, 1, timeZone) };
}

/** The calendar month (America/New_York) before the one containing `at`. */
export function previousPeriod(at: Date, timeZone = 'America/New_York'): string {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(at);
  const y = Number(fmt.find((p) => p.type === 'year')!.value);
  const m = Number(fmt.find((p) => p.type === 'month')!.value);
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  return `${py}-${String(pm).padStart(2, '0')}`;
}

/** Next 1st-of-month renewal instant: 12:00 America/New_York (gives the tier job a cutoff margin). */
export function nextRenewalAnchor(after: Date, timeZone = 'America/New_York'): Date {
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).formatToParts(after);
  let y = Number(fmt.find((p) => p.type === 'year')!.value);
  let m = Number(fmt.find((p) => p.type === 'month')!.value) + 1;
  if (m === 13) { m = 1; y += 1; }
  return zonedTime(y, m, 1, 12, timeZone);
}
