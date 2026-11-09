/**
 * Order allocation — implements "Payment allocation and delivery contributions" of the
 * Send Koro Stripe Developer Technical Brief v1.2. Everything is integer cents.
 *
 *   F food subtotal (after food discounts, before tax)   S restaurant service charges
 *   X tax payable to the restaurant                       T driver tip
 *   D final agreed delivery amount to fund                R restaurant delivery contribution
 *   C customer delivery contribution                      (invariant: C + R = D, 0 <= R <= D)
 *
 *   Q = F + S + X + C + T   → the direct charge on the restaurant's connected account
 *   A = D + T               → application_fee_amount (our "delivery fulfillment allocation")
 *   restaurant retained before Stripe fees = F + S + X − R   (= Q − A)
 */

export type Cents = number;

export class AllocationError extends Error {
  constructor(public readonly code: AllocationErrorCode, message: string) {
    super(message);
    this.name = 'AllocationError';
  }
}
export type AllocationErrorCode =
  | 'invalid_amount'
  | 'invariant_broken'
  | 'insufficient_restaurant_proceeds'
  | 'quote_expired'
  | 'rule_not_authorized'
  | 'invalid_rule';

/** Delivery rules a restaurant can authorize (mirrors the restaurant portal "Delivery fee" page). */
export type DeliveryRule =
  | { kind: 'customer_pays' }
  | { kind: 'restaurant_pays' }
  | { kind: 'split_fixed'; restaurantCents: Cents }
  /** Restaurant share as basis points of D (5000 = 50%). Remainder of rounding goes to the customer. */
  | { kind: 'split_percent'; restaurantBps: number }
  /** Free delivery when F >= minFoodCents; below it the restaurant optionally covers a fixed amount. */
  | { kind: 'free_above'; minFoodCents: Cents; belowRestaurantCents?: Cents };

export interface DeliveryConsent {
  rule: DeliveryRule;
  /** Most the restaurant pays on one order (customer pays any excess). Omit for no cap. */
  perOrderCapCents?: Cents;
  version: number;
}

export interface AllocationInput {
  foodCents: Cents; // F
  serviceChargeCents: Cents; // S
  restaurantTaxCents: Cents; // X
  tipCents: Cents; // T
  deliveryCents: Cents; // D (0 for pickup)
  consent: DeliveryConsent;
}

export interface Allocation {
  F: Cents; S: Cents; X: Cents; T: Cents;
  D: Cents; R: Cents; C: Cents;
  /** Total customer payment — amount of the direct charge. */
  Q: Cents;
  /** application_fee_amount: delivery budget plus the full driver tip. */
  A: Cents;
  /** Restaurant keeps this before Stripe fees (F + S + X − R). */
  restaurantRetained: Cents;
}

const isCents = (n: number) => Number.isInteger(n) && n >= 0;

function assertCents(name: string, n: number) {
  if (!isCents(n)) throw new AllocationError('invalid_amount', `${name} must be a non-negative integer number of cents (got ${n})`);
}

/** Restaurant contribution R for a rule, before the per-order cap. */
export function restaurantContribution(rule: DeliveryRule, F: Cents, D: Cents): Cents {
  switch (rule.kind) {
    case 'customer_pays':
      return 0;
    case 'restaurant_pays':
      return D;
    case 'split_fixed':
      assertCents('restaurantCents', rule.restaurantCents);
      return Math.min(D, rule.restaurantCents);
    case 'split_percent': {
      if (!Number.isInteger(rule.restaurantBps) || rule.restaurantBps < 0 || rule.restaurantBps > 10000) {
        throw new AllocationError('invalid_amount', 'restaurantBps must be an integer between 0 and 10000');
      }
      // Deterministic rounding: floor the restaurant share; the remainder cent goes to the customer.
      return Math.floor((D * rule.restaurantBps) / 10000);
    }
    case 'free_above':
      assertCents('minFoodCents', rule.minFoodCents);
      if (F >= rule.minFoodCents) return D;
      return Math.min(D, rule.belowRestaurantCents ?? 0);
  }
}

export function computeAllocation(input: AllocationInput): Allocation {
  const { foodCents: F, serviceChargeCents: S, restaurantTaxCents: X, tipCents: T, deliveryCents: D, consent } = input;
  for (const [k, v] of Object.entries({ F, S, X, T, D })) assertCents(k, v);

  let R = restaurantContribution(consent.rule, F, D);
  if (consent.perOrderCapCents !== undefined) {
    assertCents('perOrderCapCents', consent.perOrderCapCents);
    R = Math.min(R, consent.perOrderCapCents);
  }
  const C = D - R;
  const Q = F + S + X + C + T;
  const A = D + T;
  const restaurantRetained = F + S + X - R;

  if (C < 0 || R < 0 || R > D || C + R !== D) throw new AllocationError('invariant_broken', `C + R must equal D (C=${C}, R=${R}, D=${D})`);
  if (Q - A !== restaurantRetained) throw new AllocationError('invariant_broken', 'Q − A must equal the restaurant retained amount');
  return { F, S, X, T, D, R, C, Q, A, restaurantRetained };
}

export interface FeeEstimate {
  bps: number; fixedCents: Cents;
  /** Extra basis points Stripe adds for international cards (US standard pricing: +150). */
  internationalBps?: number;
}

/** Stripe processing fee on the whole direct charge. Stripe takes it from the restaurant's balance. */
export function estimateStripeFee(Q: Cents, fee: FeeEstimate, cardCountry?: string | null): Cents {
  if (Q === 0) return 0;
  const intl = cardCountry && cardCountry.toUpperCase() !== 'US' ? fee.internationalBps ?? 150 : 0;
  return Math.ceil((Q * (fee.bps + intl)) / 10000) + fee.fixedCents;
}

/**
 * Send Koro rule (3 Nov 2026): processing fees on the delivery money come out of the delivery
 * allocation, not the restaurant's food proceeds and never the driver's tip or locked pay.
 * The delivery money charged to the customer is C (delivery contribution) + T (tip); its share of
 * the fee is fee × (C + T) / Q, rounded to the cent. R is food money the restaurant redirects, so it
 * was already processed as food. Settled by lowering application_fee_amount by this share, so the
 * restaurant is made whole for that part of what Stripe charged it.
 */
export function deliveryFeeShare(a: Allocation, stripeFeeCents: Cents): Cents {
  if (a.Q === 0 || stripeFeeCents <= 0) return 0;
  return Math.min(a.A, Math.round((stripeFeeCents * (a.C + a.T)) / a.Q));
}

/** application_fee_amount after the delivery money bears its own share of the processing fee. */
export function applicationFeeAfterShare(a: Allocation, stripeFeeCents: Cents): Cents {
  return a.A - deliveryFeeShare(a, stripeFeeCents);
}

/**
 * Delivery markup (5 Nov 2026). The delivery price D covers the courier price plus the fees the
 * delivery money causes, so Send Koro breaks even on every delivery and never takes a fee from a
 * driver's pay or tip:
 *
 *   payout cost   = ceil((P + T) × bps / 10000) + fixed           (own drivers; per delivery)
 *                   ceil((P + T) × bps / 10000) + fixed           (third party: payout to us, then settlement to the provider)
 *   card cost     = deliveryFeeShare(allocation(D), stripeFee(Q))  (the delivery money's share)
 *   D             = smallest D with  D ≥ P + payout cost + card cost
 *
 * Then application fee after share (A − share) = P + T + payout cost: exactly the courier price, the
 * full tip, and the payout fee. The customer sees one "Delivery fee" line; there is never a separate
 * card fee, and the price is the same for every payment method.
 *
 * Worked example (third party, P = 780, F = 3000, X = 266, T = 540, restaurant pays $3.00):
 *   D = 818 → C = 518, Q = 4324, Stripe fee 156, delivery share 38; A − share = 1358 − 38 = 1320 = P + T.
 */
export interface PayoutCost { bps: number; fixedCents: Cents }
export type CourierKind = 'third_party' | 'own_driver';
export interface DeliveryPriceInput extends Omit<AllocationInput, 'deliveryCents'> {
  /** P: the courier price (provider quote; for own drivers, the same quote basis). */
  courierCents: Cents;
}
export interface DeliveryPrice {
  allocation: Allocation;
  courierCents: Cents;
  payoutMarkupCents: Cents;
  cardMarkupCents: Cents;
  /** Card share expected on this allocation (domestic card estimate). */
  estDeliveryFeeShareCents: Cents;
}

export function payoutCost(courierCents: Cents, tipCents: Cents, cost: PayoutCost): Cents {
  assertCents('courierCents', courierCents); assertCents('tipCents', tipCents);
  if (!Number.isInteger(cost.bps) || cost.bps < 0 || !isCents(cost.fixedCents)) throw new AllocationError('invalid_amount', 'payout cost must be whole basis points and cents');
  if (cost.bps === 0 && cost.fixedCents === 0) return 0;
  return Math.ceil(((courierCents + tipCents) * cost.bps) / 10000) + cost.fixedCents;
}

export function priceDelivery(input: DeliveryPriceInput, fee: FeeEstimate, payout: PayoutCost): DeliveryPrice {
  const P = input.courierCents;
  const payoutCents = payoutCost(P, input.tipCents, payout);
  const floor = P + payoutCents;
  let D = floor;
  let a = computeAllocation({ ...input, deliveryCents: D });
  // D only grows, and each step adds at most the extra share on a few cents, so this settles quickly.
  for (let i = 0; i < 20; i++) {
    const need = floor + deliveryFeeShare(a, estimateStripeFee(a.Q, fee));
    if (need <= D) break;
    D = need;
    a = computeAllocation({ ...input, deliveryCents: D });
  }
  const share = deliveryFeeShare(a, estimateStripeFee(a.Q, fee));
  return { allocation: a, courierCents: P, payoutMarkupCents: payoutCents, cardMarkupCents: D - floor, estDeliveryFeeShareCents: share };
}

/**
 * Brief §"Validation and changes": reject the quote when the restaurant cannot fund R plus its own
 * share of the processing fee from this order's proceeds, and respect application fee limits.
 */
export function validateAllocation(a: Allocation, fee: FeeEstimate): void {
  if (a.A > a.Q) throw new AllocationError('insufficient_restaurant_proceeds', 'application fee cannot exceed the charge');
  const estFee = estimateStripeFee(a.Q, fee);
  const restaurantFee = estFee - deliveryFeeShare(a, estFee);
  if (a.restaurantRetained - restaurantFee < 0) {
    throw new AllocationError(
      'insufficient_restaurant_proceeds',
      `Restaurant proceeds ${a.restaurantRetained}¢ cannot cover its delivery share and its ${restaurantFee}¢ share of the Stripe fee`,
    );
  }
}

/** Customer-facing breakdown. Never names the delivery provider. */
export function customerBreakdown(a: Allocation, restaurantName: string) {
  const lines: { label: string; amountCents: Cents }[] = [
    { label: 'Food subtotal', amountCents: a.F },
  ];
  if (a.S) lines.push({ label: 'Service charge', amountCents: a.S });
  if (a.X) lines.push({ label: `Sales tax (charged by ${restaurantName})`, amountCents: a.X });
  if (a.D) {
    lines.push({ label: 'Delivery fee', amountCents: a.D });
    if (a.R) lines.push({ label: a.R === a.D ? `Free delivery from ${restaurantName}` : `${restaurantName} pays part of delivery`, amountCents: -a.R });
  }
  if (a.T) lines.push({ label: 'Courier tip (100% to your courier)', amountCents: a.T });
  return { lines, totalCents: a.Q };
}
