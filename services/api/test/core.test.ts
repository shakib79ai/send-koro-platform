import { describe, expect, it } from 'vitest';
import { percentOf, ppmOf, splitProportionally } from '../src/core/money';
import { CartError, priceCart, MenuItemForPricing } from '../src/core/cart';
import { buildReceipt } from '../src/core/receipt';
import { nycWeeklyTopUpCents, offerPayCents, splitBatchPay } from '../src/core/rate-card';
import { planOffers, planPair } from '../src/core/batching';
import { assertTransition, canTransition, CUSTOMER_STATUS_TEXT } from '../src/core/order-status';
import { isOpenAt } from '../src/core/hours';
import { stateLaunchCheck, suggestTaxRatePpm } from '../src/core/tax';
import { doordashJwt } from '../src/dispatch/providers/doordash-drive';
import { createHmac } from 'node:crypto';
import { parseCensus } from '../src/geocode/geocode';

const MI = 1609.344;

describe('money', () => {
  it('rounds percentages half-up in integer cents', () => {
    expect(percentOf(1000, 1000)).toBe(100);
    expect(percentOf(3205, 1000)).toBe(321); // 320.5 → 321
    expect(ppmOf(1000, 88_750)).toBe(89); // 8.875% of $10.00
    expect(ppmOf(3520, 88_750)).toBe(312);
  });
  it('splits always add up exactly', () => {
    expect(splitProportionally(1540, [1210, 1100])).toEqual([807, 733]);
    expect(splitProportionally(100, [1, 1, 1]).reduce((a, b) => a + b)).toBe(100);
  });
});

const biryani: MenuItemForPricing = {
  id: 'i1', name: 'Chicken Biryani', priceCents: 1450, taxable: true, available: true,
  groups: [{ id: 'g1', name: 'Side', minSelect: 1, maxSelect: 1, options: [{ id: 'o1', name: 'Raita', priceCents: 150, available: true }, { id: 'o2', name: 'Salad', priceCents: 0, available: true }] }],
};
const menu = new Map([[biryani.id, biryani]]);

describe('cart', () => {
  it('prices items, modifiers, restaurant fees and the restaurant’s tax rate', () => {
    const c = priceCart({
      lines: [{ itemId: 'i1', quantity: 2, optionIds: ['o1'] }], menu, taxRatePpm: 88_750,
      fees: [
        { id: 'f1', kind: 'service_charge', label: 'Service charge', rateBps: 1000, taxable: false }, // forced taxable in NY
        { id: 'f2', kind: 'mandatory_gratuity', label: 'Staff gratuity', fixedCents: 200, taxable: false },
        { id: 'f3', kind: 'large_order_fee', label: 'Large order fee', fixedCents: 500, minFoodCents: 10_000, taxable: true },
      ],
    });
    expect(c.foodCents).toBe(3200);
    expect(c.fees.map((f) => [f.label, f.amountCents, f.taxable])).toEqual([['Service charge', 320, true], ['Staff gratuity', 200, false]]);
    expect(c.serviceChargeCents).toBe(520);
    expect(c.taxableBaseCents).toBe(3520);
    expect(c.taxCents).toBe(312);
  });
  it('rejects missing required options, sold-out items and unknown items', () => {
    expect(() => priceCart({ lines: [{ itemId: 'i1', quantity: 1 }], menu, fees: [], taxRatePpm: 0 })).toThrow(CartError);
    expect(() => priceCart({ lines: [{ itemId: 'nope', quantity: 1 }], menu, fees: [], taxRatePpm: 0 })).toThrow(/no longer on the menu/);
    const soldOut = new Map([[biryani.id, { ...biryani, soldOutUntil: new Date(Date.now() + 60_000) }]]);
    expect(() => priceCart({ lines: [{ itemId: 'i1', quantity: 1, optionIds: ['o2'] }], menu: soldOut, fees: [], taxRatePpm: 0 })).toThrow(/sold out/);
  });
});

describe('receipt', () => {
  const cart = priceCart({ lines: [{ itemId: 'i1', quantity: 2, optionIds: ['o1'] }], menu, fees: [{ id: 'f1', kind: 'service_charge', label: 'Service charge', rateBps: 1000, taxable: true }], taxRatePpm: 88_750 });
  it('shows one “Delivery fee” line and the restaurant’s discount; no courier name, no card fee', () => {
    const r = buildReceipt(cart, { F: 3200, S: 320, X: 312, D: 780, R: 390, C: 390, T: 400, Q: 4622 }, 'Dhaka Kitchen');
    expect(r.lines.map((l) => [l.label, l.amountCents])).toEqual([
      ['Subtotal', 3200], ['Service charge', 320], ['Sales tax', 312], ['Delivery fee', 780], ['Dhaka Kitchen pays part', -390], ['Courier tip', 400],
    ]);
    expect(r.totalCents).toBe(4622);
    const text = JSON.stringify(r);
    expect(text).not.toMatch(/uber|doordash|processing|card fee/i);
  });
  it('refuses a receipt that does not add up to the charged total', () => {
    expect(() => buildReceipt(cart, { F: 3200, S: 320, X: 312, D: 780, R: 0, C: 780, T: 0, Q: 4000 }, 'X')).toThrow(/≠/);
  });
});

describe('own-driver rate card (locked pay)', () => {
  it('2.0 mi / 18 min = $12.10; 2 orders on one route 2.8 mi / 24 min = $15.40', () => {
    expect(offerPayCents(2 * MI, 18 * 60)).toBe(1210);
    expect(offerPayCents(2.8 * MI, 24 * 60)).toBe(1540);
  });
  it('splits batch pay fairly and exactly', () => {
    const split = splitBatchPay(1540, { a: 1210, b: 1100 });
    expect(split.a + split.b).toBe(1540);
    expect(split.a).toBeGreaterThan(split.b);
  });
  it('NYC minimum: 5 h of trips with $98 pay → $12.65 top-up; tips are not counted', () => {
    expect(nycWeeklyTopUpCents([{ durationSeconds: 18_000, payCents: 9_800 }])).toEqual({ minimumCents: 11_065, paidCents: 9_800, topUpCents: 1_265 });
    expect(nycWeeklyTopUpCents([{ durationSeconds: 3_600, payCents: 3_000 }]).topUpCents).toBe(0);
  });
});

describe('batching', () => {
  const pickup = { lat: 40.7411, lng: -73.9897 }; // Flatiron
  it('pairs two nearby dropoffs from the same restaurant into one offer', () => {
    const a = { orderId: 'a', pickup, dropoff: { lat: 40.7484, lng: -73.9857 } };
    const b = { orderId: 'b', pickup, dropoff: { lat: 40.7505, lng: -73.9934 } };
    const plan = planPair(a, b)!;
    expect(plan.orderIds).toHaveLength(2);
    expect(plan.payPerOrder.a + plan.payPerOrder.b).toBe(plan.payCents);
    expect(planOffers([a, b])).toHaveLength(1);
  });
  it('pays the driver each order’s delivery fee minus card share and payout cost (P), tip on top', () => {
    const a = { orderId: 'a', pickup, dropoff: { lat: 40.7484, lng: -73.9857 }, driverPayCents: 780 }; // fee 848 − card 39 − payout 29
    const b = { orderId: 'b', pickup, dropoff: { lat: 40.7505, lng: -73.9934 }, driverPayCents: 650 };
    expect(planOffers([{ ...a, dropoff: { lat: 40.7033, lng: -74.0170 } }])[0]).toMatchObject({ payCents: 780, payPerOrder: { a: 780 } });
    const plan = planPair(a, b)!;
    expect(plan.payCents).toBe(1430);
    expect(plan.payPerOrder).toEqual({ a: 780, b: 650 });
  });
  it('does not pair far-apart dropoffs', () => {
    const a = { orderId: 'a', pickup, dropoff: { lat: 40.7484, lng: -73.9857 } };
    const c = { orderId: 'c', pickup, dropoff: { lat: 40.7033, lng: -74.0170 } }; // Battery Park
    expect(planPair(a, c)).toBeNull();
    expect(planOffers([a, c])).toHaveLength(2);
  });
});

describe('order status', () => {
  it('allows the normal path and blocks skipping acceptance', () => {
    expect(canTransition('placed', 'accepted')).toBe(true);
    expect(() => assertTransition('placed', 'picked_up')).toThrow();
    expect(() => assertTransition('delivered', 'cancelled')).toThrow();
  });
  it('customer wording never names a courier company', () => {
    expect(JSON.stringify(CUSTOMER_STATUS_TEXT)).not.toMatch(/uber|doordash/i);
  });
});

describe('hours', () => {
  const tz = 'America/New_York';
  it('handles normal and past-midnight hours in New York time', () => {
    const hours = [{ dayOfWeek: 2, opensAt: '11:00', closesAt: '22:00' }, { dayOfWeek: 5, opensAt: '18:00', closesAt: '02:00' }];
    expect(isOpenAt(hours, tz, new Date('2026-11-03T17:00:00Z'))).toBe(true); // Tue 12:00 EST
    expect(isOpenAt(hours, tz, new Date('2026-11-04T04:00:00Z'))).toBe(false); // Tue 23:00
    expect(isOpenAt(hours, tz, new Date('2026-11-07T06:30:00Z'))).toBe(true); // Sat 01:30 (Fri night)
  });
  it('23:59 closes at midnight with no gap; open == close is 24 hours', () => {
    const tue2359 = new Date('2026-11-04T04:59:30Z'); // Tue 23:59:30 EST
    expect(isOpenAt([{ dayOfWeek: 2, opensAt: '10:00', closesAt: '23:59' }], tz, tue2359)).toBe(true);
    expect(isOpenAt([{ dayOfWeek: 2, opensAt: '00:00', closesAt: '00:00' }], tz, tue2359)).toBe(true);
  });
});

describe('tax policy', () => {
  it('suggests the NYC rate but launches only in states where the platform never collects', () => {
    expect(suggestTaxRatePpm('NY', '10010').ratePpm).toBe(88_750);
    expect(stateLaunchCheck('NY').allowed).toBe(true);
    expect(stateLaunchCheck('GA')).toMatchObject({ allowed: false });
    expect(stateLaunchCheck('TX').allowed).toBe(false);
  });
});

describe('DoorDash Drive JWT', () => {
  it('is HS256 with dd-ver DD-JWT-V1, signed with the base64url-decoded secret', () => {
    const secret = Buffer.from('test-signing-secret').toString('base64url');
    const jwt = doordashJwt({ developerId: 'dev', keyId: 'key', signingSecret: secret }, 1_700_000_000);
    const [h, p, s] = jwt.split('.');
    expect(JSON.parse(Buffer.from(h, 'base64url').toString())).toEqual({ alg: 'HS256', typ: 'JWT', 'dd-ver': 'DD-JWT-V1' });
    expect(JSON.parse(Buffer.from(p, 'base64url').toString())).toMatchObject({ aud: 'doordash', iss: 'dev', kid: 'key', exp: 1_700_000_300 });
    expect(s).toBe(createHmac('sha256', Buffer.from('test-signing-secret')).update(`${h}.${p}`).digest('base64url'));
  });
});

describe('geocoder', () => {
  it('turns a Census match into an address with coordinates', () => {
    const r = parseCensus({ result: { addressMatches: [{ matchedAddress: '350 5TH AVE, NEW YORK, NY, 10118', coordinates: { x: -73.9857, y: 40.7484 },
      addressComponents: { fromAddress: '350', streetName: '5TH', suffixType: 'AVE', city: 'NEW YORK', state: 'NY', zip: '10118' } }] } });
    expect(r).toEqual([{ line1: '350 5th Ave', city: 'New York', state: 'NY', postalCode: '10118', lat: 40.7484, lng: -73.9857, matched: '350 5TH AVE, NEW YORK, NY, 10118' }]);
    expect(parseCensus({})).toEqual([]);
  });
});
