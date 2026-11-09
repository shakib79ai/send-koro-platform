/**
 * Driver pay (7 Nov 2026): each order pays the driver its delivery fee minus the card-fee share and
 * the payout cost, which is exactly the courier price P the fee was built from (payments
 * allocation.ts priceDelivery: D = P + payout + card share). The tip is added on top, 100%.
 *
 *   Customer and restaurant see the delivery fee D = 848 ($8.48).
 *   Card-fee share 39, payout cost 29 → driver's locked pay = 848 − 39 − 29 = 780 ($7.80) + tip.
 *   Two orders on one route: 780 + 650 = 1430 for both, each order keeps its own share.
 *
 * Orders without a stored courier price (none in normal operation) fall back to the rate card.
 *
 * Two orders on one route, like Uber and DoorDash. Only orders from the same pickup whose
 * dropoffs are close together are paired, and only if the shared route is not much longer than
 * the longer solo trip — so neither customer waits much longer.
 */
import { estimateRoute, haversineMeters, Point } from './geo';
import { offerPayCents, splitBatchPay } from './rate-card';

export interface PendingDelivery { orderId: string; pickup: Point; dropoff: Point; readyAt?: Date | null; /** P: delivery fee minus card share and payout cost */ driverPayCents?: number | null }
export interface PlannedOffer {
  orderIds: string[]; distanceMeters: number; durationSeconds: number; payCents: number; payPerOrder: Record<string, number>;
}

export const BATCH_LIMITS = { maxDropoffGapMeters: 1500, maxExtraSeconds: 600, sameRestaurantOnly: true } as const;

export function planSolo(d: PendingDelivery): PlannedOffer {
  const r = estimateRoute([d.pickup, d.dropoff]);
  const pay = d.driverPayCents != null && d.driverPayCents > 0 ? d.driverPayCents : offerPayCents(r.distanceMeters, r.durationSeconds);
  return { orderIds: [d.orderId], ...r, payCents: pay, payPerOrder: { [d.orderId]: pay } };
}

export function planPair(a: PendingDelivery, b: PendingDelivery, limits = BATCH_LIMITS): PlannedOffer | null {
  if (haversineMeters(a.pickup, b.pickup) > 50) return null; // same pickup only
  if (haversineMeters(a.dropoff, b.dropoff) > limits.maxDropoffGapMeters) return null;
  const ab = estimateRoute([a.pickup, a.dropoff, b.dropoff]);
  const ba = estimateRoute([a.pickup, b.dropoff, a.dropoff]);
  const [route, first, second] = ab.durationSeconds <= ba.durationSeconds ? [ab, a, b] : [ba, b, a];
  const soloA = planSolo(a), soloB = planSolo(b);
  if (route.durationSeconds - Math.max(soloA.durationSeconds, soloB.durationSeconds) > limits.maxExtraSeconds) return null;
  if (soloA.payCents === a.driverPayCents && soloB.payCents === b.driverPayCents) {
    // Each order brings its own net delivery fee; the batch pays both in full.
    return { orderIds: [first.orderId, second.orderId], ...route, payCents: soloA.payCents + soloB.payCents, payPerOrder: { [a.orderId]: soloA.payCents, [b.orderId]: soloB.payCents } };
  }
  const pay = offerPayCents(route.distanceMeters, route.durationSeconds);
  return {
    orderIds: [first.orderId, second.orderId], ...route, payCents: pay,
    payPerOrder: splitBatchPay(pay, { [soloA.orderIds[0]]: soloA.payCents, [soloB.orderIds[0]]: soloB.payCents }),
  };
}

/** Greedy pairing: oldest first, pair with the best partner if one qualifies. */
export function planOffers(pending: PendingDelivery[]): PlannedOffer[] {
  const left = [...pending];
  const out: PlannedOffer[] = [];
  while (left.length) {
    const a = left.shift()!;
    let best: { i: number; plan: PlannedOffer } | null = null;
    left.forEach((b, i) => {
      const plan = planPair(a, b);
      if (plan && (!best || plan.durationSeconds < best.plan.durationSeconds)) best = { i, plan };
    });
    if (best) { out.push((best as { plan: PlannedOffer }).plan); left.splice((best as { i: number }).i, 1); }
    else out.push(planSolo(a));
  }
  return out;
}
