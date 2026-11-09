import { describe, expect, it } from 'vitest';
import { computeAllocation } from '../src/core/allocation';
import { emptyRefunded, fullCancellation, planRefund, RefundError } from '../src/core/refunds';
import { monthBounds, nextRenewalAnchor, previousPeriod, RESTAURANT_TIERS, selectTier } from '../src/core/tiers';

const equal = computeAllocation({ foodCents: 3000, serviceChargeCents: 0, restaurantTaxCents: 0, tipCents: 0, deliveryCents: 1000, consent: { rule: { kind: 'split_percent', restaurantBps: 5000 }, version: 1 } });
const ctx = (over = {}) => ({ allocation: equal, already: emptyRefunded(), deliveryFulfilled: false, tipSettled: false, ...over });

describe('refund allocation (brief)', () => {
  it('cancelled before fulfilment: refund $35 on the charge and return the $10 delivery allocation', () => {
    const p = planRefund(fullCancellation(equal), ctx());
    expect(p.chargeRefundCents).toBe(3500);
    expect(p.applicationFeeRefundCents).toBe(1000);
    // restaurant: received 3500 − fee 1000 = 2500; refunds 3500; gets 1000 back → 0
    expect(3500 - 1000 - p.chargeRefundCents + p.applicationFeeRefundCents).toBe(0);
  });
  it('returning only the customer’s $5 would leave the restaurant funding an unfulfilled subsidy', () => {
    const p = planRefund({ ...fullCancellation(equal), restoreSubsidyCents: 0 }, ctx());
    expect(3500 - 1000 - p.chargeRefundCents + p.applicationFeeRefundCents).toBe(-500);
  });
  it('food-only partial refund keeps the delivery allocation when delivery was fulfilled', () => {
    const p = planRefund({ foodCents: 700, serviceChargeCents: 0, taxCents: 0, customerDeliveryCents: 0, restoreSubsidyCents: 0, tipCents: 0, reason: 'missing_item' }, ctx({ deliveryFulfilled: true }));
    expect([p.chargeRefundCents, p.applicationFeeRefundCents, p.tierBaseDeductionCents]).toEqual([700, 0, 700]);
  });
  it('fulfilled delivery is only refunded with an explicit delivery_* reason', () => {
    const req = { foodCents: 0, serviceChargeCents: 0, taxCents: 0, customerDeliveryCents: 500, restoreSubsidyCents: 0, tipCents: 0, reason: 'goodwill' };
    expect(() => planRefund(req, ctx({ deliveryFulfilled: true }))).toThrow(RefundError);
    expect(planRefund({ ...req, reason: 'delivery_late' }, ctx({ deliveryFulfilled: true })).applicationFeeRefundCents).toBe(500);
  });
  it('a paid tip is never clawed back automatically', () => {
    const tipped = computeAllocation({ foodCents: 3000, serviceChargeCents: 0, restaurantTaxCents: 0, tipCents: 400, deliveryCents: 1000, consent: { rule: { kind: 'customer_pays' }, version: 1 } });
    expect(() => planRefund({ foodCents: 0, serviceChargeCents: 0, taxCents: 0, customerDeliveryCents: 0, restoreSubsidyCents: 0, tipCents: 400, reason: 'x' }, ctx({ allocation: tipped, tipSettled: true }))).toThrow(/not clawed back/);
  });
  it('cannot refund more than the original component across several refunds', () => {
    const already = { ...emptyRefunded(), foodCents: 2500 };
    expect(() => planRefund({ foodCents: 600, serviceChargeCents: 0, taxCents: 0, customerDeliveryCents: 0, restoreSubsidyCents: 0, tipCents: 0, reason: 'x' }, ctx({ already }))).toThrow(/exceeds/);
  });
});

describe('subscription tiers', () => {
  it('brief example: October $20,000 − $1,000 refunds = $19,000 base → top band', () => {
    expect(selectTier(19_000_00).priceCents).toBe(500_00);
  });
  it('band edges and negative / zero months', () => {
    expect(selectTier(2_500_00).priceCents).toBe(50_00);
    expect(selectTier(2_500_01).priceCents).toBe(100_00);
    expect(selectTier(15_000_00).priceCents).toBe(350_00);
    expect(selectTier(0).lookupKey).toBe(RESTAURANT_TIERS[0].lookupKey);
    expect(selectTier(-5_000).lookupKey).toBe(RESTAURANT_TIERS[0].lookupKey);
  });
  it('calendar months are New York months (DST aware)', () => {
    const oct = monthBounds('2026-10');
    expect(oct.start.toISOString()).toBe('2026-10-01T04:00:00.000Z'); // EDT
    expect(oct.end.toISOString()).toBe('2026-11-01T04:00:00.000Z');
    const dec = monthBounds('2026-12');
    expect(dec.start.toISOString()).toBe('2026-12-01T05:00:00.000Z'); // EST
    expect(dec.end.toISOString()).toBe('2027-01-01T05:00:00.000Z');
  });
  it('previous period is computed in New York time', () => {
    expect(previousPeriod(new Date('2026-11-01T03:30:00Z'))).toBe('2026-09'); // still Oct 31 in New York
    expect(previousPeriod(new Date('2026-11-01T05:30:00Z'))).toBe('2026-10');
    expect(previousPeriod(new Date('2027-01-15T12:00:00Z'))).toBe('2026-12');
  });
  it('renewal anchor is noon New York on the next 1st, including the DST changeover day', () => {
    expect(nextRenewalAnchor(new Date('2026-10-20T12:00:00Z')).toISOString()).toBe('2026-11-01T17:00:00.000Z'); // Nov 1 2026 is EST after 2am
    expect(nextRenewalAnchor(new Date('2026-06-10T12:00:00Z')).toISOString()).toBe('2026-07-01T16:00:00.000Z');
  });
});
