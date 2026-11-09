/**
 * End-to-end against real Postgres + a recording fake Stripe. Mirrors the brief's
 * "Minimum acceptance tests". Needs TEST_DATABASE_URL (defaults to a local test instance).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { Pool } from 'pg';
import { createDb, Db } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import * as t from '../src/db/schema';
import { CheckoutService } from '../src/payments/checkout.service';
import { estimateStripeFee, priceDelivery } from '../src/core/allocation';
import { LedgerService } from '../src/payments/ledger.service';
import { OnboardingService } from '../src/payments/onboarding.service';
import { RefundsService } from '../src/payments/refunds.service';
import { SettlementService } from '../src/payments/settlement.service';
import { SubscriptionsService } from '../src/payments/subscriptions.service';
import { RegistryService } from '../src/payments/registry.service';
import { ReportsService } from '../src/payments/reports.service';
import { ConnectDashboardService } from '../src/payments/connect-dashboard.service';
import { WebhooksService } from '../src/webhooks/webhooks.service';
import { createFakeStripe, signedEvent } from './fake-stripe';

const URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5433/sendkoro_test';
const SECRETS = { platform: 'whsec_platform_test', connect: 'whsec_connect_test' };
let db: Db; let pool: Pool;

async function reset() {
  const p = new Pool({ connectionString: URL });
  await p.query('drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;');
  await p.end();
  await runMigrations(URL);
}

function build(fake: ReturnType<typeof createFakeStripe>, now = () => new Date()) {
  const ledger = new LedgerService(fake.stripe, db);
  const settlement = new SettlementService(fake.stripe, db, ledger);
  const alerts: string[] = [];
  const subs = new SubscriptionsService(fake.stripe, db, ledger, { firstMonthFree: true, alert: (m) => alerts.push(m) }, now);
  const onboarding = new OnboardingService(fake.stripe, db, { restaurantPortalUrl: 'https://r.test', driverAppUrl: 'https://d.test', paymentMethodDomain: 'sendkoro.com' });
  const fulfilled: string[] = [];
  return {
    ledger, settlement, subs, onboarding, alerts, fulfilled,
    checkout: new CheckoutService(fake.stripe, db, { bps: 290, fixedCents: 30 }, now),
    refunds: new RefundsService(fake.stripe, db, ledger),
    webhooks: new WebhooksService(fake.stripe, db, SECRETS, ledger, settlement, subs, onboarding, async (id) => { fulfilled.push(id); }),
  };
}

async function seed(rule: unknown = { kind: 'split_percent', restaurantBps: 5000 }) {
  const [r] = await db.insert(t.restaurants).values({ name: 'Dhaka Kitchen', contactEmail: 'owner@dhaka.test', stripeAccountId: 'acct_rest1', onboardingStatus: 'active', cardPaymentsActive: true, taxResponsibilityAcceptedAt: new Date() }).returning();
  await db.insert(t.deliveryConsents).values({ restaurantId: r.id, version: 1, rule, acceptedBy: 'owner@dhaka.test', validFrom: new Date('2026-01-01T00:00:00Z') });
  const [d] = await db.insert(t.drivers).values({ name: 'Rahim Uddin', contactEmail: 'rahim@test', stripeAccountId: 'acct_drv1', onboardingStatus: 'active', transfersActive: true }).returning();
  return { r, d };
}

const deliveryQuote = (restaurantId: string, extra = {}) => ({
  restaurantId, foodCents: 3000, tipCents: 400,
  delivery: { provider: 'own_driver' as const, providerQuoteId: 'q_1', deliveryCents: 1000, expiresAt: new Date(Date.now() + 10 * 60_000) }, ...extra,
});

/** Simulate Stripe: capture → signed payment_intent.succeeded on the restaurant account. */
async function payAndDeliverEvent(svc: ReturnType<typeof build>, fake: ReturnType<typeof createFakeStripe>, orderId: string, eventId = 'evt_paid_1') {
  await svc.checkout.accept(orderId);
  const pi = fake.callsTo('paymentIntents.capture').at(-1)!;
  const captured = await fake.stripe.paymentIntents.capture(pi.params.piId, {}, pi.opts);
  const { payload, header } = signedEvent(SECRETS.connect, { id: eventId, type: 'payment_intent.succeeded', account: 'acct_rest1', data: { object: captured } });
  const event = svc.webhooks.verify('connect', payload, header);
  return svc.webhooks.handle(event);
}

beforeAll(async () => {
  try { const p = new Pool({ connectionString: URL }); await p.query('select 1'); await p.end(); }
  catch { throw new Error(`Postgres not reachable at ${URL} — set TEST_DATABASE_URL`); }
  ({ db, pool } = createDb(URL));
});
afterAll(async () => { await pool?.end(); });
beforeEach(async () => { await reset(); });

describe('checkout → direct charge', () => {
  it('creates the PaymentIntent on the restaurant account with application_fee_amount = D + T − delivery fee share', async () => {
    const fake = createFakeStripe(); const svc = build(fake); const { r } = await seed();
    const q = await svc.checkout.quote(deliveryQuote(r.id));
    expect(q.allocation).toMatchObject({ C: 500, R: 500, Q: 3900, A: 1400, restaurantRetained: 2500 });
    expect(JSON.stringify(q.customer)).not.toMatch(/uber|doordash/i);
    const pay = await svc.checkout.createPayment(q.quoteId);
    const call = fake.callsTo('paymentIntents.create')[0];
    expect(call.opts.stripeAccount).toBe('acct_rest1'); // direct charge, restaurant context
    // est. fee on $39 = 2.9% + 30¢ = 144¢; delivery money (C $5 + T $4) bears 144 × 900/3900 = 33¢
    expect(q.estDeliveryFeeShareCents).toBe(33);
    expect(call.params).toMatchObject({ amount: 3900, application_fee_amount: 1400 - 33, currency: 'usd', capture_method: 'manual' });
    expect(call.params.transfer_data).toBeUndefined(); // never a platform charge
    expect(call.params.metadata).toMatchObject({ D: '1000', C: '500', R: '500', T: '400', consent_version: '1' });
    expect(pay.stripeAccount).toBe('acct_rest1');
  });

  it('retrying payment creation returns the same order and PaymentIntent', async () => {
    const fake = createFakeStripe(); const svc = build(fake); const { r } = await seed();
    const q = await svc.checkout.quote(deliveryQuote(r.id));
    const a = await svc.checkout.createPayment(q.quoteId);
    const b = await svc.checkout.createPayment(q.quoteId);
    expect(b.orderId).toBe(a.orderId);
    expect(b.paymentIntentId).toBe(a.paymentIntentId);
    expect(fake.effects('paymentIntents.create')).toBe(1);
  });

  it('expired quote, missing consent and missing tax acceptance are rejected', async () => {
    const fake = createFakeStripe(); const svc = build(fake); const { r } = await seed();
    await expect(svc.checkout.quote(deliveryQuote(r.id, { delivery: { provider: 'own_driver', deliveryCents: 1000, expiresAt: new Date(Date.now() - 1000) } }))).rejects.toMatchObject({ code: 'quote_expired' });
    await db.update(t.restaurants).set({ taxResponsibilityAcceptedAt: null }).where(eq(t.restaurants.id, r.id));
    await expect(svc.checkout.quote(deliveryQuote(r.id))).rejects.toMatchObject({ code: 'rule_not_authorized' });
  });

  it('rejects a quote the restaurant cannot fund (insufficient proceeds)', async () => {
    const fake = createFakeStripe(); const svc = build(fake); const { r } = await seed({ kind: 'restaurant_pays' });
    await expect(svc.checkout.quote(deliveryQuote(r.id, { foodCents: 900 }))).rejects.toMatchObject({ code: 'insufficient_restaurant_proceeds' });
  });

  it('payment status marks the order authorised once the card is held', async () => {
    const fake = createFakeStripe(); const s = build(fake); await seed();
    const [r] = await db.select().from(t.restaurants);
    const q = await s.checkout.quote({ restaurantId: r.id, foodCents: 3000, tipCents: 400, delivery: { provider: 'uber_direct', deliveryCents: 780, expiresAt: new Date(Date.now() + 600_000) } });
    const p = await s.checkout.createPayment(q.quoteId);
    const st = await s.checkout.paymentStatus(p.orderId);
    expect(st).toMatchObject({ authorized: true, paymentIntentStatus: 'requires_capture' });
    const [o] = await db.select().from(t.orders).where(eq(t.orders.id, p.orderId));
    expect(o.status).toBe('authorized');
  });
  it('declined order releases the authorisation instead of charging', async () => {
    const fake = createFakeStripe(); const svc = build(fake); const { r } = await seed();
    const q = await svc.checkout.quote(deliveryQuote(r.id));
    const p = await svc.checkout.createPayment(q.quoteId);
    await svc.checkout.decline(p.orderId, 'auto_declined');
    expect(fake.callsTo('paymentIntents.cancel')[0].opts.stripeAccount).toBe('acct_rest1');
    const [o] = await db.select().from(t.orders).where(eq(t.orders.id, p.orderId));
    expect(o.status).toBe('declined');
  });
});

describe('processing fees come out of the delivery money', () => {
  it('capture recomputes the share for the real card, credits the restaurant and books it as a delivery cost; driver pay and tip untouched', async () => {
    const fake = createFakeStripe({ cardCountry: 'GB', stripeFeeCents: 202 }); const svc = build(fake); const { r, d } = await seed();
    const q = await svc.checkout.quote(deliveryQuote(r.id));
    const p = await svc.checkout.createPayment(q.quoteId);
    await payAndDeliverEvent(svc, fake, p.orderId, 'evt_fee');
    // International card: 4.4% + 30¢ on $39 = 202¢ → delivery share 202 × 900/3900 = 47¢
    expect(fake.callsTo('paymentIntents.capture')[0].params).toMatchObject({ application_fee_amount: 1400 - 47 });
    const [o] = await db.select().from(t.orders).where(eq(t.orders.id, p.orderId));
    expect(o).toMatchObject({ applicationFeeCents: 1353, deliveryFeeShareCents: 47, cardCountry: 'GB' });
    const rows = Object.fromEntries((await db.select().from(t.ledgerEntries).where(eq(t.ledgerEntries.orderId, p.orderId))).map((x) => [x.account, x.amountCents]));
    expect(rows).toMatchObject({ stripe_fee_restaurant: -202, restaurant_fee_share_credit: 47, delivery_processing_fee: -47, driver_tip: 400 });
    await svc.settlement.ownDriverDelivered(p.orderId, d.id, 1210);
    expect(fake.callsTo('transfers.create')[0].params.amount).toBe(1210 + 400); // locked pay + full tip, no fee deducted
    const margin = (await db.select().from(t.ledgerEntries).where(eq(t.ledgerEntries.account, 'fulfillment_margin')))[0].amountCents;
    expect(margin).toBe(1000 - 1210 - 47); // Send Koro's delivery money absorbs the fee
  });
  it('third-party courier: provider gets its full quote and tip; the fee share is a delivery cost', async () => {
    const fake = createFakeStripe({ stripeFeeCents: 144 }); const svc = build(fake); const { r } = await seed();
    const q = await svc.checkout.quote({ ...deliveryQuote(r.id), delivery: { provider: 'doordash_drive', deliveryCents: 1000, expiresAt: new Date(Date.now() + 600_000) } });
    const p = await svc.checkout.createPayment(q.quoteId);
    await payAndDeliverEvent(svc, fake, p.orderId, 'evt_fee_3p');
    const a = await svc.settlement.supplierAssigned(p.orderId, 'doordash_drive', 'dd_1');
    expect(a).toEqual({ tipCentsToSubmit: 400, quotedCents: 1000 });
    const rows = (await db.select().from(t.ledgerEntries).where(eq(t.ledgerEntries.orderId, p.orderId))).filter((x) => ['supplier_cost_owed', 'fulfillment_margin'].includes(x.account));
    expect(Object.fromEntries(rows.map((x) => [x.account, x.amountCents]))).toEqual({ supplier_cost_owed: -1000, fulfillment_margin: -33 });
  });
  it('delivery markup on: the price covers the card share, the courier is owed only its quote, and Send Koro breaks even', async () => {
    const pricing = { bps: 290, fixedCents: 30 };
    const expected = priceDelivery({ foodCents: 3000, serviceChargeCents: 0, restaurantTaxCents: 0, tipCents: 400, courierCents: 1000, consent: { rule: { kind: 'split_percent', restaurantBps: 5000 }, version: 1 } }, pricing, { bps: 25, fixedCents: 25 });
    const fake = createFakeStripe({ stripeFeeCents: estimateStripeFee(expected.allocation.Q, pricing) }); const svc = build(fake); const { r } = await seed();
    const markup = new CheckoutService(fake.stripe, db, pricing, () => new Date(), { enabled: true, ownDriver: { bps: 25, fixedCents: 25 }, thirdParty: { bps: 25, fixedCents: 25 } });
    const q = await markup.quote({ ...deliveryQuote(r.id), delivery: { provider: 'uber_direct', deliveryCents: 1000, expiresAt: new Date(Date.now() + 600_000) } });
    expect(q.allocation.D).toBe(expected.allocation.D);
    expect(q.courierCents).toBe(1000);
    expect(q.payoutMarkupCents).toBe(Math.ceil((1000 + 400) * 25 / 10000) + 25); // payout to us, then settlement to Uber
    expect(q.cardMarkupCents).toBe(expected.allocation.D - 1000 - q.payoutMarkupCents);
    expect(q.cardMarkupCents).toBeGreaterThan(0);
    const [row] = await db.select().from(t.quotes).where(eq(t.quotes.id, q.quoteId));
    expect([row.courierCents, row.cardMarkupCents, row.payoutMarkupCents]).toEqual([1000, q.cardMarkupCents, q.payoutMarkupCents]);
    const p = await markup.createPayment(q.quoteId);
    await payAndDeliverEvent(svc, fake, p.orderId, 'evt_fee_markup');
    const a = await svc.settlement.supplierAssigned(p.orderId, 'uber_direct', 'del_m1');
    expect(a).toEqual({ tipCentsToSubmit: 400, quotedCents: 1000 }); // the provider is owed its own quote, not D
    const rows = (await db.select().from(t.ledgerEntries).where(eq(t.ledgerEntries.orderId, p.orderId))).filter((x) => ['supplier_cost_owed', 'fulfillment_margin'].includes(x.account));
    const m = Object.fromEntries(rows.map((x) => [x.account, x.amountCents]));
    expect(m.supplier_cost_owed).toBe(-1000);
    const margin = m.fulfillment_margin ?? 0; // what's left is the payout + settlement cost it was priced to cover
    expect(margin).toBeGreaterThanOrEqual(q.payoutMarkupCents);
    expect(margin).toBeLessThanOrEqual(q.payoutMarkupCents + 2);
  });
  it('delivery markup on: own drivers also get the payout cost added, and still receive locked pay + the full tip', async () => {
    const fake = createFakeStripe(); const svc = build(fake); const { r } = await seed();
    const markup = new CheckoutService(fake.stripe, db, { bps: 290, fixedCents: 30 }, () => new Date(), { enabled: true, ownDriver: { bps: 25, fixedCents: 25 }, thirdParty: { bps: 0, fixedCents: 0 } });
    const q = await markup.quote(deliveryQuote(r.id));
    expect(q.payoutMarkupCents).toBe(Math.ceil((1000 + 400) * 25 / 10000) + 25);
    expect(q.allocation.D).toBe(1000 + q.payoutMarkupCents + q.cardMarkupCents);
    const pickup = await markup.quote({ ...deliveryQuote(r.id), tipCents: 0, delivery: { provider: 'pickup' } });
    expect([pickup.allocation.D, pickup.cardMarkupCents, pickup.payoutMarkupCents]).toEqual([0, 0, 0]);
    void svc;
  });
});

describe('webhooks', () => {
  it('rejects a bad signature', async () => {
    const fake = createFakeStripe(); const svc = build(fake);
    const { payload } = signedEvent(SECRETS.connect, { id: 'evt_x', type: 'payment_intent.succeeded', data: { object: {} } });
    expect(() => svc.webhooks.verify('connect', payload, 't=1,v1=deadbeef')).toThrow();
  });

  it('payment success writes a separated ledger once, even when the event is delivered twice', async () => {
    const fake = createFakeStripe({ stripeFeeCents: 143 }); const svc = build(fake); const { r } = await seed();
    const q = await svc.checkout.quote(deliveryQuote(r.id));
    const p = await svc.checkout.createPayment(q.quoteId);
    expect(await payAndDeliverEvent(svc, fake, p.orderId)).toBe(true);
    // Duplicate delivery of the same event
    const captured = await fake.stripe.paymentIntents.capture(p.paymentIntentId, {}, { stripeAccount: 'acct_rest1', idempotencyKey: `order-capture:${p.orderId}` });
    const dup = signedEvent(SECRETS.connect, { id: 'evt_paid_1', type: 'payment_intent.succeeded', account: 'acct_rest1', data: { object: captured } });
    expect(await svc.webhooks.handle(svc.webhooks.verify('connect', dup.payload, dup.header))).toBe(false);

    const rows = await db.select().from(t.ledgerEntries).where(eq(t.ledgerEntries.orderId, p.orderId));
    const by = Object.fromEntries(rows.map((x) => [x.account, x.amountCents]));
    expect(by).toMatchObject({ restaurant_food: 3000, restaurant_delivery_contribution: -500, customer_delivery: 500, delivery_allocation: 1000, driver_tip: 400, stripe_fee_restaurant: -143 });
    expect(rows.find((x) => x.account === 'driver_tip')!.state).toBe('owed');
    expect(svc.fulfilled).toEqual([p.orderId]); // fulfilment triggered exactly once
    const [o] = await db.select().from(t.orders).where(eq(t.orders.id, p.orderId));
    expect(o).toMatchObject({ status: 'paid', applicationFeeId: `fee_for_ch_for_${p.paymentIntentId}`, stripeFeeCents: 143 });
    expect(fake.callsTo('charges.retrieve')[0].opts.stripeAccount).toBe('acct_rest1');
  });
});

async function paidOrder(svc: ReturnType<typeof build>, fake: ReturnType<typeof createFakeStripe>, rId: string, tipCents = 0) {
  const q = await svc.checkout.quote(deliveryQuote(rId, { tipCents }));
  const p = await svc.checkout.createPayment(q.quoteId);
  await payAndDeliverEvent(svc, fake, p.orderId, `evt_${p.orderId}`);
  return p.orderId;
}

describe('refunds', () => {
  it('full cancellation: $35 refunded on the charge and the $10 allocation returned to the restaurant', async () => {
    const fake = createFakeStripe(); const svc = build(fake); const { r } = await seed();
    const orderId = await paidOrder(svc, fake, r.id);
    const res = await svc.refunds.refund(orderId, { foodCents: 3000, serviceChargeCents: 0, taxCents: 0, customerDeliveryCents: 500, restoreSubsidyCents: 500, tipCents: 0, reason: 'cancelled_before_fulfillment' }, 'support-1');
    const rc = fake.callsTo('refunds.create')[0];
    expect(rc.opts.stripeAccount).toBe('acct_rest1');
    expect(rc.params).toMatchObject({ amount: 3500, refund_application_fee: false });
    // captured fee was D − share (1000 − 19¢); the platform returns all of it, and the 19¢ delivery fee share
    // Stripe kept on the refunded charge is recorded as owed back to the restaurant.
    expect(fake.callsTo('applicationFees.createRefund')[0].params.amount).toBe(981);
    const owed = await db.select().from(t.ledgerEntries).where(eq(t.ledgerEntries.account, 'fee_share_owed_to_restaurant'));
    expect(owed[0].amountCents).toBe(19);
    expect(res.status).toBe('succeeded');
    const [o] = await db.select().from(t.orders).where(eq(t.orders.id, orderId));
    expect(o.status).toBe('refunded');
  });
  it('food-only partial refund after delivery: no application fee refund; same request id is idempotent', async () => {
    const fake = createFakeStripe(); const svc = build(fake); const { r, d } = await seed();
    const orderId = await paidOrder(svc, fake, r.id);
    await svc.settlement.ownDriverDelivered(orderId, d.id, 900);
    const req = { foodCents: 700, serviceChargeCents: 0, taxCents: 0, customerDeliveryCents: 0, restoreSubsidyCents: 0, tipCents: 0, reason: 'missing_item' };
    await svc.refunds.refund(orderId, req, 'support-2');
    await svc.refunds.refund(orderId, req, 'support-2');
    expect(fake.effects('refunds.create')).toBe(1);
    expect(fake.callsTo('applicationFees.createRefund')).toHaveLength(0);
    await expect(svc.refunds.refund(orderId, { ...req, foodCents: 2400 }, 'support-3')).rejects.toMatchObject({ code: 'over_refund' });
  });
  it('a tip already paid to the driver cannot be refunded automatically', async () => {
    const fake = createFakeStripe(); const svc = build(fake); const { r, d } = await seed();
    const orderId = await paidOrder(svc, fake, r.id, 400);
    await svc.settlement.ownDriverDelivered(orderId, d.id, 900);
    await expect(svc.refunds.refund(orderId, { foodCents: 0, serviceChargeCents: 0, taxCents: 0, customerDeliveryCents: 0, restoreSubsidyCents: 0, tipCents: 400, reason: 'x' }, 'support-4')).rejects.toMatchObject({ code: 'tip_settled' });
  });
});

describe('driver settlement', () => {
  async function paid(svc: ReturnType<typeof build>, fake: ReturnType<typeof createFakeStripe>, rId: string) {
    const q = await svc.checkout.quote(deliveryQuote(rId));
    const p = await svc.checkout.createPayment(q.quoteId);
    await payAndDeliverEvent(svc, fake, p.orderId, `evt_${p.orderId}`);
    return p.orderId;
  }
  it('pays locked offer pay + 100% tip once, even if completion is reported twice', async () => {
    const fake = createFakeStripe(); const svc = build(fake); const { r, d } = await seed();
    const orderId = await paid(svc, fake, r.id);
    await svc.settlement.ownDriverDelivered(orderId, d.id, 1210);
    await svc.settlement.ownDriverDelivered(orderId, d.id, 1210);
    const tr = fake.callsTo('transfers.create');
    expect(fake.effects('transfers.create')).toBe(1);
    expect(tr[0].params).toMatchObject({ amount: 1210 + 400, destination: 'acct_drv1', transfer_group: `order_${orderId}` });
    expect(tr[0].params.metadata).toMatchObject({ tip_cents: '400' });
    const [row] = await db.select().from(t.driverTransfers);
    expect(row.status).toBe('paid');
  });
  it('insufficient available balance → owed, then paid by the retry job', async () => {
    const fake = createFakeStripe({ availableBalance: 100 }); const svc = build(fake); const { r, d } = await seed();
    const orderId = await paid(svc, fake, r.id);
    const res = await svc.settlement.ownDriverDelivered(orderId, d.id, 1210);
    expect(res!.status).toBe('owed');
    expect(fake.callsTo('transfers.create')).toHaveLength(0);
    fake.state.availableBalance = 1_000_000;
    await svc.settlement.retryOwed();
    const [row] = await db.select().from(t.driverTransfers);
    expect(row.status).toBe('paid');
  });
  it('an open dispute holds the driver transfer', async () => {
    const fake = createFakeStripe({ availableBalance: 0 }); const svc = build(fake); const { r, d } = await seed();
    const orderId = await paid(svc, fake, r.id);
    await svc.settlement.ownDriverDelivered(orderId, d.id, 1210); // owed (no balance)
    const [o] = await db.select().from(t.orders).where(eq(t.orders.id, orderId));
    const ev = signedEvent(SECRETS.connect, { id: 'evt_dp', type: 'charge.dispute.created', account: 'acct_rest1', data: { object: { id: 'dp_1', object: 'dispute', charge: o.chargeId } } });
    await svc.webhooks.handle(svc.webhooks.verify('connect', ev.payload, ev.header));
    fake.state.availableBalance = 1_000_000;
    await svc.settlement.retryOwed();
    const [row] = await db.select().from(t.driverTransfers);
    expect(row.status).toBe('on_hold');
    expect(fake.callsTo('transfers.create')).toHaveLength(0);
  });
  it('NYC minimum pay: weekly shortfall transferred once; no top-up when pay already meets it', async () => {
    const fake = createFakeStripe(); const s = build(fake); const { d } = await seed();
    const t1 = await s.settlement.weeklyTopUp(d.id, '2026-11-02', 18_000, 9_800);
    expect(t1).toMatchObject({ minimumCents: 11_065, amountCents: 1_265, status: 'paid' });
    await s.settlement.weeklyTopUp(d.id, '2026-11-02', 18_000, 9_800);
    const transfers = fake.calls.filter((c) => c.method === 'transfers.create');
    expect(transfers).toHaveLength(1);
    expect(transfers[0].params).toMatchObject({ amount: 1_265, destination: 'acct_drv1' });
    expect(transfers[0].opts).toMatchObject({ idempotencyKey: `driver-topup:${d.id}:2026-11-02` });
    const t2 = await s.settlement.weeklyTopUp(d.id, '2026-11-09', 3_600, 3_000);
    expect(t2).toMatchObject({ amountCents: 0, status: 'paid' });
  });
  it('third-party supplier: tip recorded for the provider tip field and invoice reconciled', async () => {
    const fake = createFakeStripe(); const svc = build(fake); const { r } = await seed();
    const q = await svc.checkout.quote({ ...deliveryQuote(r.id), delivery: { provider: 'uber_direct', providerQuoteId: 'dqt_1', deliveryCents: 1000, expiresAt: new Date(Date.now() + 600_000) } });
    const p = await svc.checkout.createPayment(q.quoteId);
    await payAndDeliverEvent(svc, fake, p.orderId, 'evt_tp');
    const a = await svc.settlement.supplierAssigned(p.orderId, 'uber_direct', 'del_123');
    expect(a).toEqual({ tipCentsToSubmit: 400, quotedCents: 1000 });
    expect(await svc.settlement.reconcileSupplierLine(p.orderId, { billedCents: 1120, tipCents: 400, invoiceRef: 'inv_UD_W44' })).toEqual({ deliveryVariance: 120, tipVariance: 0, matched: false });
    expect(fake.callsTo('transfers.create')).toHaveLength(0); // suppliers are paid by invoice, not Connect
  });
});

describe('subscription tiers', () => {
  it('October: $20,000 food − $1,000 refunds → $19,000 base → $500 price, no proration; re-run is a no-op', async () => {
    const fake = createFakeStripe(); const now = () => new Date('2026-11-01T05:30:00Z'); const svc = build(fake, now); const { r } = await seed();
    const sub = await svc.subs.ensureRestaurantSubscription(r.id);
    expect(fake.callsTo('subscriptions.create')[0].params).toMatchObject({ customer_account: 'acct_rest1', trial_end: Math.floor(new Date('2026-12-01T17:00:00Z').getTime() / 1000) });
    // seed ledger: an order + entries dated in October (and one in November that must be ignored)
    const q = await svc.checkout.quote(deliveryQuote(r.id));
    const p = await svc.checkout.createPayment(q.quoteId);
    await svc.ledger.write(p.orderId, r.id, 'oct-sales', [{ account: 'restaurant_food', amountCents: 20_000_00, state: 'available' }], new Date('2026-10-15T15:00:00Z'));
    await svc.ledger.write(p.orderId, r.id, 'oct-refunds', [{ account: 'refund_food', amountCents: -1_000_00, state: 'paid' }], new Date('2026-10-31T23:30:00-04:00'));
    await svc.ledger.write(p.orderId, r.id, 'nov-sales', [{ account: 'restaurant_food', amountCents: 9_999_00, state: 'available' }], new Date('2026-11-01T00:30:00-04:00'));
    const res = await svc.subs.runRestaurantTierJob();
    expect(res[0]).toMatchObject({ period: '2026-10', netBaseCents: 19_000_00, tier: 'sk_restaurant_tier_500', changed: true });
    const up = fake.callsTo('subscriptions.update')[0];
    expect(up.params).toMatchObject({ subId: sub.stripeSubscriptionId, proration_behavior: 'none', items: [{ id: sub.stripeItemId, price: 'price_sk_restaurant_tier_500' }] });
    const again = await svc.subs.runRestaurantTierJob();
    expect(again[0].skipped).toBe('snapshot exists');
    expect(fake.callsTo('subscriptions.update')).toHaveLength(1);
    const [snap] = await db.select().from(t.tierSnapshots);
    expect(snap).toMatchObject({ period: '2026-10', foodSalesCents: 20_000_00, foodRefundsCents: 1_000_00, netBaseCents: 19_000_00, ruleVersion: 'restaurant-2026-11-v1' });
  });
  it('renewal invoice without a tier snapshot is paused for review', async () => {
    const fake = createFakeStripe(); const svc = build(fake); const { r } = await seed();
    const sub = await svc.subs.ensureRestaurantSubscription(r.id);
    const invoice = { id: 'in_1', object: 'invoice', billing_reason: 'subscription_cycle', created: Math.floor(new Date('2026-12-01T17:00:00Z').getTime() / 1000), parent: { subscription_details: { subscription: sub.stripeSubscriptionId } }, lines: { data: [] } };
    const ev = signedEvent(SECRETS.platform, { id: 'evt_inv', type: 'invoice.created', data: { object: invoice } });
    await svc.webhooks.handle(svc.webhooks.verify('platform', ev.payload, ev.header));
    expect(fake.callsTo('invoices.update')[0].params).toMatchObject({ invId: 'in_1', auto_advance: false });
    expect(svc.alerts[0]).toMatch(/paused/);
  });
});

describe('onboarding (Accounts v2)', () => {
  it('restaurant account: full dashboard, Stripe collects fees and owns losses, merchant + customer configs', async () => {
    const fake = createFakeStripe(); const svc = build(fake);
    const [r] = await db.insert(t.restaurants).values({ name: 'Green Bowl Co.', contactEmail: 'gb@test' }).returning();
    const url = await svc.onboarding.restaurantOnboardingLink(r.id);
    const p = fake.callsTo('v2.accounts.create')[0].params;
    expect(p).toMatchObject({ dashboard: 'full', defaults: { responsibilities: { fees_collector: 'stripe', losses_collector: 'stripe' } }, configuration: { merchant: { capabilities: { card_payments: { requested: true } } }, customer: {} } });
    expect(fake.callsTo('v2.accountLinks.create')[0].params.use_case.account_onboarding.configurations).toEqual(['merchant', 'customer']);
    expect(url).toMatch(/^https:\/\/connect\.stripe\.test\//);
    const acct = (await db.select().from(t.restaurants).where(eq(t.restaurants.id, r.id)))[0].stripeAccountId!;
    const s = await svc.onboarding.syncAccount(acct);
    expect(s).toEqual({ type: 'restaurant', active: true });
    expect(fake.callsTo('paymentMethodDomains.create')[0]).toMatchObject({ params: { domain_name: 'sendkoro.com' }, opts: { stripeAccount: acct } });
  });
  it('driver account: connected like a restaurant (full dashboard, Stripe fees & losses) with recipient transfers', async () => {
    const fake = createFakeStripe(); const svc = build(fake);
    const [d] = await db.insert(t.drivers).values({ name: 'Kemi', contactEmail: 'k@test' }).returning();
    await svc.onboarding.driverOnboardingLink(d.id);
    const p = fake.callsTo('v2.accounts.create')[0].params;
    expect(p).toMatchObject({ dashboard: 'full', defaults: { responsibilities: { fees_collector: 'stripe', losses_collector: 'stripe' } } });
    expect(p.configuration).toEqual({ recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } });
  });
});

describe('admin reports', () => {
  it('overview, restaurant money, payouts on the connected account, driver settlements and billing', async () => {
    const fake = createFakeStripe(); const s = build(fake); const { r, d } = await seed();
    const orderId = await paidOrder(s, fake, r.id, 400);
    await s.settlement.ownDriverDelivered(orderId, d.id, 900);
    const reports = new ReportsService(fake.stripe, db);
    const range = [new Date(Date.now() - 86_400_000), new Date(Date.now() + 60_000)] as const;
    const o = await reports.overview(...range);
    expect(o).toMatchObject({ paidOrders: 1, commissionCents: 0 });
    expect(o.volumeCents).toBeGreaterThan(0);
    expect(o.driverTransfers).toEqual([{ status: 'paid', count: 1, cents: 1300 }]);
    const m = await reports.restaurantMoney(r.id, ...range);
    expect(m.transactions).toHaveLength(1);
    expect(m.ledger.restaurant_food).toBeGreaterThan(0);
    const p = await reports.accountPayouts('restaurant', r.id);
    expect(p).toMatchObject({ stripeAccountId: 'acct_rest1', payouts: [{ id: 'po_1', amountCents: 12345 }] });
    expect(fake.callsTo('payouts.list')[0].opts).toMatchObject({ stripeAccount: 'acct_rest1' });
    (fake.stripe as any).payouts.list = async () => { throw new Error('connection refused'); };
    expect(await reports.accountPayouts('restaurant', r.id)).toMatchObject({ balance: null, payouts: [], error: expect.stringContaining('connection refused') });
    expect((await reports.driverSettlements({})).transfers[0]).toMatchObject({ amountCents: 1300, driverName: 'Rahim Uddin' });
    expect(await reports.billing()).toEqual([]);
  });
});

describe('Stripe tab (Connect embedded components + overview)', () => {
  it('restaurant: account session follows our money rules; overview shows schedule, bank, balance and payouts', async () => {
    const fake = createFakeStripe(); const { r } = await seed();
    const svc = new ConnectDashboardService(fake.stripe, db, new ReportsService(fake.stripe, db));
    const sess = await svc.accountSession('restaurant', r.id);
    expect(sess).toMatchObject({ clientSecret: expect.stringContaining('acct_rest1_secret'), stripeAccountId: 'acct_rest1' });
    const c = fake.callsTo('accountSessions.create')[0].params;
    expect(c.account).toBe('acct_rest1');
    expect(c.components.payments.features).toMatchObject({ refund_management: false, capture_payments: false, dispute_management: true });
    expect(c.components.payouts.features).toMatchObject({ instant_payouts: false });
    const o = await svc.overview('restaurant', r.id);
    expect(o).toMatchObject({ setup: 'active', ready: true, requirementsDue: [], payoutSchedule: 'Every Monday (2 days to arrive)', bank: { name: 'CHASE', last4: '4410' }, payouts: [{ id: 'po_1' }], error: null });
    expect(o.statement).toBeUndefined();
  });

  it('driver: no payments list, weekly statement with pay, 100% tips and NYC top-ups', async () => {
    const fake = createFakeStripe(); const s = build(fake); const { r, d } = await seed();
    const orderId = await paidOrder(s, fake, r.id, 400);
    await s.settlement.ownDriverDelivered(orderId, d.id, 900);
    const svc = new ConnectDashboardService(fake.stripe, db, new ReportsService(fake.stripe, db));
    await svc.accountSession('driver', d.id);
    const c = fake.callsTo('accountSessions.create')[0].params.components;
    expect(c.payments).toBeUndefined();
    expect(c.payouts.features).toMatchObject({ instant_payouts: false, edit_payout_schedule: false });
    const o = await svc.overview('driver', d.id);
    expect(o.statement?.[0]).toMatchObject({ trips: 1, payCents: 900, tipCents: 400, topUpCents: 0, totalCents: 1300 });
  });

  it('no Stripe account yet: no session, overview says not started', async () => {
    const fake = createFakeStripe();
    const [d] = await db.insert(t.drivers).values({ name: 'New', contactEmail: 'n@test' }).returning();
    const svc = new ConnectDashboardService(fake.stripe, db, new ReportsService(fake.stripe, db));
    expect(await svc.accountSession('driver', d.id)).toEqual({ clientSecret: null, reason: 'no_account' });
    expect(await svc.overview('driver', d.id)).toMatchObject({ setup: 'not_started', stripeAccountId: null, statement: [] });
    expect(fake.callsTo('accountSessions.create')).toHaveLength(0);
  });
});

describe('registry (core API mirror)', () => {
  it('upserts a restaurant by the caller ID, records tax acceptance once, and versions delivery consents', async () => {
    const reg = new RegistryService(db);
    const id = '6f1d2c1e-8a8b-4c55-9a51-0b3a1f3e9a10';
    await reg.upsertRestaurant({ id, name: 'Dhaka Kitchen', contactEmail: 'a@test.dev' });
    const renamed = await reg.upsertRestaurant({ id, name: 'Dhaka Kitchen II', contactEmail: 'a@test.dev' });
    expect(renamed.name).toBe('Dhaka Kitchen II');
    expect(await reg.restaurantStatus(id)).toMatchObject({ ready: false, taxResponsibilityAccepted: false });
    const t1 = (await reg.acceptTaxResponsibility(id)).taxResponsibilityAcceptedAt;
    const t2 = (await reg.acceptTaxResponsibility(id)).taxResponsibilityAcceptedAt;
    expect(t1).toEqual(t2);
    const v1 = await reg.setDeliveryConsent(id, { rule: { kind: 'customer_pays' }, acceptedBy: 'owner' });
    const same = await reg.setDeliveryConsent(id, { rule: { kind: 'customer_pays' }, acceptedBy: 'owner' });
    expect(same.id).toBe(v1.id);
    const v2 = await reg.setDeliveryConsent(id, { rule: { kind: 'split_percent', restaurantBps: 5000 }, perOrderCapCents: 400, acceptedBy: 'owner' });
    expect(v2.version).toBe(2);
    const rows = await db.select().from(t.deliveryConsents).where(eq(t.deliveryConsents.restaurantId, id));
    expect(rows.filter((r) => r.validTo === null)).toHaveLength(1);
    await expect(reg.setDeliveryConsent(id, { rule: { kind: 'split_percent', restaurantBps: 12000 }, acceptedBy: 'owner' })).rejects.toThrow(/0–10000/);
  });
});

describe('schema', () => {
  it('ledger rejects duplicate dedupe keys at the database level', async () => {
    const fake = createFakeStripe(); const svc = build(fake); const { r } = await seed();
    const q = await svc.checkout.quote(deliveryQuote(r.id));
    const p = await svc.checkout.createPayment(q.quoteId);
    await svc.ledger.write(p.orderId, r.id, 'k', [{ account: 'restaurant_food', amountCents: 1, state: 'available' }]);
    await svc.ledger.write(p.orderId, r.id, 'k', [{ account: 'restaurant_food', amountCents: 1, state: 'available' }]);
    const n = await db.execute(sql`select count(*)::int as n from ledger_entries where dedupe_key = 'k:restaurant_food'`);
    expect((n.rows[0] as { n: number }).n).toBe(1);
  });
});
