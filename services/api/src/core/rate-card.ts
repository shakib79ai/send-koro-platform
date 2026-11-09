/**
 * FALLBACK ONLY since 7 Nov 2026: own-driver pay is now each order's delivery fee minus the card
 * share and payout cost (= courier price P; see core/batching.ts). This rate card is used only when
 * an order has no stored courier price. NYC minimum-pay logic below is unchanged and always applies.
 *
 * Own-driver pay (BUSINESS_MODEL.md §Own drivers). Upfront and locked: what the offer shows is
 * what the driver is paid, never reduced for traffic or delays, and no fees are deducted (rule 6).
 *
 *   pay = 250 (pickup) + 45 × minutes + 75 × miles      (cents)
 *   2.0 mi, 18 min → 250 + 810 + 150 = 1210 ($12.10)
 *   Batch of 2 on one route, 2.8 mi, 24 min → 250 + 1080 + 210 = 1540 ($15.40) for both
 *
 * Minutes round up to the next whole minute; mile cents round half-up.
 */
import { Cents, splitProportionally } from './money';

export const RATE_CARD = { pickupCents: 250, perMinuteCents: 45, perMileCents: 75 } as const;
const METERS_PER_MILE = 1609.344;

export function offerPayCents(distanceMeters: number, durationSeconds: number, card = RATE_CARD): Cents {
  if (distanceMeters < 0 || durationSeconds < 0) throw new Error('distance and duration must be ≥ 0');
  const minutes = Math.ceil(durationSeconds / 60);
  const mileCents = Math.round((distanceMeters * card.perMileCents) / METERS_PER_MILE);
  return card.pickupCents + minutes * card.perMinuteCents + mileCents;
}

/**
 * Per-order split of a batched offer, weighted by what each order would have paid alone, so
 * each order's record shows a fair share. Parts always add up to the batch pay exactly.
 */
export function splitBatchPay(batchPayCents: Cents, soloPayCents: Record<string, Cents>): Record<string, Cents> {
  const ids = Object.keys(soloPayCents);
  const parts = splitProportionally(batchPayCents, ids.map((i) => soloPayCents[i]));
  return Object.fromEntries(ids.map((id, i) => [id, parts[i]]));
}

/**
 * NYC minimum pay for app-based restaurant delivery workers: $22.13 per hour of trip time
 * (standard method). Tips never count toward it. If the week's locked pay is below the minimum
 * for actual trip time, the shortfall is added to the weekly payout.
 *
 *   Trips totalling 5 h 00 m with $98.00 pay → minimum 5 × 2213 = 11065 → top-up 1265.
 */
export const NYC_MIN_CENTS_PER_HOUR = 2213;

export function nycWeeklyTopUpCents(trips: { durationSeconds: number; payCents: Cents }[], centsPerHour = NYC_MIN_CENTS_PER_HOUR): { minimumCents: Cents; paidCents: Cents; topUpCents: Cents } {
  const seconds = trips.reduce((a, t) => a + t.durationSeconds, 0);
  const minimumCents = Math.ceil((seconds * centsPerHour) / 3600);
  const paidCents = trips.reduce((a, t) => a + t.payCents, 0);
  return { minimumCents, paidCents, topUpCents: Math.max(0, minimumCents - paidCents) };
}
