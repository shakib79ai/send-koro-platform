/**
 * End-to-end order flows against real Postgres, with a fake payments service and mock couriers.
 * Needs TEST_DATABASE_URL (defaults to the Docker Postgres from the root docker-compose.yml).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { eq } from 'drizzle-orm';
import { JwtService } from '@nestjs/jwt';
import { createDb, Db } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import * as t from '../src/db/schema';
import { AuthService } from '../src/auth/auth.service';
import type { AuthUser, Role } from '../src/auth/auth.guard';
import { ConsoleSms } from '../src/integrations/sms';
import { ConsolePush } from '../src/integrations/push';
import { EventBus } from '../src/realtime/events';
import { NotificationsService } from '../src/notifications/notifications.service';
import { CustomersService } from '../src/customers/customers.service';
import { RestaurantsService } from '../src/restaurants/restaurants.service';
import { MenuService } from '../src/menu/menu.service';
import { CatalogService } from '../src/catalog/catalog.service';
import { OrderStateService } from '../src/orders/order-state.service';
import { OrdersService } from '../src/orders/orders.service';
import { DispatchService } from '../src/dispatch/dispatch.service';
import { MockProvider } from '../src/dispatch/providers/mock';
import { DriversService } from '../src/drivers/drivers.service';
import { AdminService } from '../src/admin/admin.service';
import { createFakePayments } from './fake-payments';

const URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5433/sendkoro_api_test';
const { db } = createDb(URL) as { db: Db };

async function reset() {
  const p = new Pool({ connectionString: URL });
  await p.query('drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;');
  await p.end();
  await runMigrations(URL);
}

function build(dispatchOrder = 'own_driver,uber_direct,doordash_drive') {
  const fake = createFakePayments();
  const sms = new ConsoleSms();
  const events = new EventBus();
  const notify = new NotificationsService(db, events, new ConsolePush());
  const uber = new MockProvider('uber_direct');
  const doordash = new MockProvider('doordash_drive');
  const auth = new AuthService(db, new JwtService({ secret: 'x'.repeat(32) }), sms, { accessTtlSeconds: 900, refreshTtlDays: 30, pepper: 'pepper' });
  const restaurants = new RestaurantsService(db, fake.client);
  const menu = new MenuService(db, restaurants);
  const state = new OrderStateService(db, notify);
  const dispatch = new DispatchService(db, { uber_direct: uber, doordash_drive: doordash }, fake.client, state, notify, dispatchOrder);
  const orders = new OrdersService(db, fake.client, menu, restaurants, dispatch, state, notify, { autoDeclineMinutes: 5 });
  return {
    fake, sms, events, uber, doordash, auth, restaurants, menu, state, dispatch, orders,
    customers: new CustomersService(db),
    catalog: new CatalogService(db, menu),
    drivers: new DriversService(db, fake.client, dispatch, state, notify),
    admin: new AdminService(db, fake.client, dispatch, state),
  };
}
type App = ReturnType<typeof build>;

async function signIn(app: App, phone: string, role: Role): Promise<AuthUser> {
  await app.auth.requestCode(phone, role);
  const code = app.sms.sent.at(-1)!.body.slice(0, 6);
  const res = await app.auth.verifyCode(phone, role, code, { name: 'Test ' + role, email: `${role}@test.dev` });
  return { id: res.user.id, role, phone };
}

const FLATIRON = { lat: 40.7411, lng: -73.9897 };
const ALL_WEEK = Array.from({ length: 7 }, (_, d) => ({ dayOfWeek: d, opensAt: '00:00', closesAt: '23:59' }));

/** Restaurant ready to sell: NYC location, hours, tax accepted, 50/50 delivery split, 10% service charge, a menu item. */
async function liveRestaurant(app: App) {
  const owner = await signIn(app, '+19175550100', 'restaurant_staff');
  const r = await app.restaurants.create(owner, { name: 'Dhaka Kitchen', contactEmail: 'owner@dhaka.test', cuisine: 'Bangladeshi' });
  const loc = await app.restaurants.addLocation(owner, r.id, { name: 'Flatiron', phone: '+19175550101', line1: '12 W 21st St', city: 'New York', state: 'NY', postalCode: '10010', ...FLATIRON });
  expect(loc.taxRatePpm).toBe(88_750); // suggested NYC rate
  await app.restaurants.setHours(owner, loc.id, ALL_WEEK);
  await expect(app.restaurants.goLive(owner, r.id)).rejects.toMatchObject({ code: 'not_ready' });
  await app.restaurants.acceptTaxResponsibility(owner, r.id);
  await app.restaurants.setDeliveryRule(owner, r.id, { rule: { kind: 'split_percent', restaurantBps: 5000 } });
  await app.restaurants.addFee(owner, r.id, { kind: 'service_charge', label: 'Service charge', rateBps: 1000 });
  const item = await app.menu.addItem(owner, r.id, {
    name: 'Chicken Biryani', priceCents: 1450,
    groups: [{ name: 'Side', minSelect: 1, maxSelect: 1, options: [{ name: 'Raita', priceCents: 150 }, { name: 'Salad', priceCents: 0 }] }],
  });
  app.fake.restaurants.get(r.id)!.ready = true; // Stripe onboarding finished
  await app.restaurants.goLive(owner, r.id);
  const full = await app.menu.menu(r.id);
  const raita = full.uncategorized[0].groups[0].options.find((o) => o.name === 'Raita')!;
  return { owner, r, loc, item, raita };
}

async function customerWithAddress(app: App, phone = '+19175550200', dropoff = { lat: 40.7484, lng: -73.9857 }) {
  const c = await signIn(app, phone, 'customer');
  const a = await app.customers.add(c.id, { label: 'home', line1: '350 5th Ave', city: 'New York', state: 'NY', postalCode: '10118', ...dropoff, dropoffInstructions: 'Front desk' });
  return { c, a };
}

async function placedOrder(app: App, s: Awaited<ReturnType<typeof liveRestaurant>>, cu: Awaited<ReturnType<typeof customerWithAddress>>, key = 'key-00000001') {
  const input = { locationId: s.loc.id, fulfilment: 'delivery' as const, addressId: cu.a.id, lines: [{ itemId: s.item.id, quantity: 2, optionIds: [s.raita.id] }], tipCents: 400 };
  const preview = await app.orders.preview(cu.c, input);
  const placed = await app.orders.place(cu.c, { ...input, idempotencyKey: key, expectedTotalCents: preview.receipt.totalCents });
  const [row] = await db.select().from(t.orders).where(eq(t.orders.id, placed.order.id));
  app.fake.authorize(row.paymentsOrderId!);
  await app.orders.confirmPayment(cu.c, row.id);
  return { preview, placed, orderId: row.id, paymentsOrderId: row.paymentsOrderId! };
}

beforeEach(reset);

describe('sign-in (phone code)', () => {
  it('one flow for sign up and sign in; codes are single-use; refresh tokens rotate', async () => {
    const app = build();
    await app.auth.requestCode('+19175550300', 'customer');
    const code = app.sms.sent[0].body.slice(0, 6);
    await expect(app.auth.verifyCode('+19175550300', 'customer', code === '000000' ? '111111' : '000000')).rejects.toMatchObject({ code: 'code_invalid' });
    const first = await app.auth.verifyCode('+19175550300', 'customer', code);
    expect(first.isNew).toBe(true);
    await expect(app.auth.verifyCode('+19175550300', 'customer', code)).rejects.toMatchObject({ code: 'code_invalid' });
    const refreshed = await app.auth.refresh(first.refreshToken);
    await expect(app.auth.refresh(first.refreshToken)).rejects.toMatchObject({ code: 'refresh_invalid' });
    expect(refreshed.user.id).toBe(first.user.id);
  });
  it('admins cannot self sign-up', async () => {
    const app = build();
    await app.auth.requestCode('+19175550399', 'admin');
    expect(app.sms.sent).toHaveLength(0);
  });
});

describe('restaurant setup', () => {
  it('blocks states whose marketplace law would make Send Koro collect tax', async () => {
    const app = build();
    const owner = await signIn(app, '+19175550100', 'restaurant_staff');
    const r = await app.restaurants.create(owner, { name: 'Peach Grill', contactEmail: 'p@test.dev' });
    await expect(app.restaurants.addLocation(owner, r.id, { name: 'ATL', line1: '1 Peachtree St', city: 'Atlanta', state: 'GA', postalCode: '30303', lat: 33.75, lng: -84.39 })).rejects.toMatchObject({ code: 'state_not_available' });
  });
  it('staff cannot change delivery-fee or tax settings; a mandatory gratuity must say “gratuity”', async () => {
    const app = build();
    const s = await liveRestaurant(app);
    const staff = await app.restaurants.addTeammate(s.owner, s.r.id, { phone: '+19175550111', role: 'staff' });
    const staffUser: AuthUser = { id: staff.userId, role: 'restaurant_staff', phone: staff.phone };
    await expect(app.restaurants.setDeliveryRule(staffUser, s.r.id, { rule: { kind: 'restaurant_pays' } })).rejects.toMatchObject({ code: 'forbidden' });
    await expect(app.restaurants.addFee(s.owner, s.r.id, { kind: 'mandatory_gratuity', label: 'Staff fee', rateBps: 1800 })).rejects.toMatchObject({ code: 'invalid_fee' });
    expect(app.fake.callsTo('setDeliveryConsent')).toHaveLength(1);
  });

  it('Stripe tab: only the owner sees Stripe details; staff are refused', async () => {
    const app = build();
    const s = await liveRestaurant(app);
    const o = await app.restaurants.stripeOverview(s.owner, s.r.id);
    expect(o).toMatchObject({ kind: 'restaurant', setup: 'active', bank: { last4: '4410' } });
    expect(await app.restaurants.stripeAccountSession(s.owner, s.r.id)).toMatchObject({ clientSecret: expect.stringContaining('secret') });
    const staff = await app.restaurants.addTeammate(s.owner, s.r.id, { phone: '+19175550112', role: 'staff' });
    const staffUser: AuthUser = { id: staff.userId, role: 'restaurant_staff', phone: staff.phone };
    await expect(app.restaurants.stripeOverview(staffUser, s.r.id)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(app.restaurants.stripeAccountSession(staffUser, s.r.id)).rejects.toMatchObject({ code: 'forbidden' });
    expect(app.fake.callsTo('stripeAccountSession')).toHaveLength(1);
  });
});

describe('ordering → third-party courier', () => {
  it('quote, place (idempotent), authorise, accept → capture → courier gets the full tip', async () => {
    const app = build();
    const s = await liveRestaurant(app);
    const cu = await customerWithAddress(app);

    const near = await app.catalog.nearby({ lat: 40.7484, lng: -73.9857 });
    expect(near[0]).toMatchObject({ name: 'Dhaka Kitchen', open: true, delivers: true });

    const { preview, placed, orderId, paymentsOrderId } = await placedOrder(app, s, cu);
    // 2 × (1450 + 150) = 3200 food, 10% service charge 320, 8.875% tax on 3520 = 312.
    const D = preview.deliveryQuote!.feeCents, R = Math.floor(D / 2);
    expect(preview.receipt.lines.map((l) => l.label)).toEqual(['Subtotal', 'Service charge', 'Sales tax', 'Delivery fee', 'Dhaka Kitchen pays part', 'Courier tip']);
    expect(preview.receipt.totalCents).toBe(3200 + 320 + 312 + (D - R) + 400);
    expect(JSON.stringify(preview.receipt)).not.toMatch(/uber|doordash|processing/i);
    expect(placed.payment?.clientSecret).toBeTruthy();

    // Double-tapped "Place order" → same order, same PaymentIntent.
    const again = await app.orders.place(cu.c, { locationId: s.loc.id, fulfilment: 'delivery', addressId: cu.a.id, lines: [{ itemId: s.item.id, quantity: 2, optionIds: [s.raita.id] }], tipCents: 400, idempotencyKey: 'key-00000001', expectedTotalCents: preview.receipt.totalCents });
    expect(again.order.id).toBe(orderId);
    expect((await db.select().from(t.orders)).length).toBe(1);

    expect((await app.state.load(orderId)).status).toBe('placed');
    const live = await app.orders.liveOrders(s.owner, s.r.id);
    expect(live[0]).toMatchObject({ id: orderId, status: 'placed' });
    expect(live[0].acceptBy).toBeInstanceOf(Date);

    // No own drivers online → Uber Direct (mock) with 100% tip in its tip field.
    await app.orders.accept(s.owner, orderId);
    expect(app.fake.callsTo('accept')).toEqual([{ method: 'accept', args: [paymentsOrderId] }]);
    const create = app.uber.calls.find((c) => c.op === 'create')!.req as { tipCents: number; externalId: string };
    expect(create).toMatchObject({ tipCents: 400, externalId: orderId });
    expect(app.fake.callsTo('supplierAssigned')[0].args).toEqual([paymentsOrderId, 'uber_direct', expect.any(String)]);
    expect(app.fake.callsTo('supplierTipSubmitted')).toHaveLength(1);

    // Customer view never names the courier company.
    const view = await app.orders.customerOrder(cu.c, orderId);
    expect(JSON.stringify(view)).not.toMatch(/uber|doordash|track\.example/i);
    // The delivery markup and the courier's own price stay in admin (5 Nov 2026): customers and restaurants see one delivery fee.
    expect(JSON.stringify(view)).not.toMatch(/markup|courierCents|providerQuote|feeCents/i);
    expect(JSON.stringify(await app.orders.liveOrders(s.owner, s.r.id))).not.toMatch(/markup|courierCents|providerQuote|feeCents|uber|doordash/i);

    // Courier webhooks move the order along.
    const [del] = await db.select().from(t.deliveries).where(eq(t.deliveries.orderId, orderId));
    await app.dispatch.providerUpdate('uber_direct', del.providerDeliveryId!, 'picked_up');
    await app.dispatch.providerUpdate('uber_direct', del.providerDeliveryId!, 'delivered');
    expect((await app.state.load(orderId)).status).toBe('delivered');

    // Restaurant sales summary: food, service charge and tax counted; tips excluded; $0 commission.
    const sum = await app.orders.summary(s.owner, s.r.id, { from: new Date(Date.now() - 86_400_000), to: new Date(Date.now() + 60_000) });
    expect(sum).toMatchObject({ orders: 1, foodCents: 3200, serviceChargeCents: 320, taxCents: 312, deliveryPaidCents: R, commissionCents: 0 });
    expect(sum.daily).toHaveLength(1);

    // Admin sees the provider, integration status and tax compliance.
    expect((await app.admin.order(orderId)).delivery?.provider).toBe('uber_direct');
    const integ = await app.admin.integrationStatus();
    expect(integ.paymentsServiceUp).toBe(true);
    expect(integ.last7Days).toContainEqual({ provider: 'uber_direct', status: 'delivered', n: 1 });
    const tax = await app.admin.taxCompliance();
    expect(tax.policy.platformCollectsTax).toBe(false);
    expect(tax.restaurants[0]).toMatchObject({ name: 'Dhaka Kitchen', locations: [{ state: 'NY', taxRatePpm: 88_750 }] });
    expect(tax.restaurants[0].taxResponsibilityAcceptedAt).toBeTruthy();
  });

  it('falls back to DoorDash Drive when Uber Direct cannot quote', async () => {
    const app = build('uber_direct,doordash_drive');
    const s = await liveRestaurant(app);
    const cu = await customerWithAddress(app);
    const { orderId } = await placedOrder(app, s, cu);
    app.uber.failQuotes = true;
    await app.orders.accept(s.owner, orderId);
    const [del] = await db.select().from(t.deliveries).where(eq(t.deliveries.orderId, orderId));
    expect(del.provider).toBe('doordash_drive');
  });

  it('a changed price is caught before payment', async () => {
    const app = build();
    const s = await liveRestaurant(app);
    const cu = await customerWithAddress(app);
    await expect(app.orders.place(cu.c, { locationId: s.loc.id, fulfilment: 'delivery', addressId: cu.a.id, lines: [{ itemId: s.item.id, quantity: 1, optionIds: [s.raita.id] }], tipCents: 0, idempotencyKey: 'key-00000002', expectedTotalCents: 1 }))
      .rejects.toMatchObject({ code: 'price_changed' });
    expect(app.fake.callsTo('createPayment')).toHaveLength(0);
  });
});

describe('declines and cancellations release the card hold', () => {
  it('restaurant decline, customer cancel before acceptance, and the 5-minute auto-decline', async () => {
    const app = build();
    const s = await liveRestaurant(app);
    const cu = await customerWithAddress(app);

    const a = await placedOrder(app, s, cu, 'key-decline-1');
    await app.orders.decline(s.owner, a.orderId, 'Out of rice');
    expect((await app.state.load(a.orderId)).status).toBe('declined');

    const b = await placedOrder(app, s, cu, 'key-cancel-01');
    await app.orders.cancelByCustomer(cu.c, b.orderId);
    expect(app.fake.callsTo('decline').map((c) => c.args[1])).toEqual(['restaurant_declined', 'customer_cancelled']);

    const c = await placedOrder(app, s, cu, 'key-auto-0001');
    await db.update(t.orders).set({ placedAt: new Date(Date.now() - 6 * 60_000) }).where(eq(t.orders.id, c.orderId));
    expect(await app.orders.autoDecline()).toEqual({ declined: 1 });
    expect((await app.state.load(c.orderId)).status).toBe('declined');
    expect(app.fake.callsTo('accept')).toHaveLength(0); // never captured
  });
});

describe('own drivers: locked offers, batching, pay', () => {
  async function onlineDriver(app: App, phone = '+19175550400', at = { lat: 40.7420, lng: -73.9890 }) {
    const u = await signIn(app, phone, 'driver');
    const d = await app.drivers.apply(u, { name: 'Rahim Uddin', email: `${phone.slice(-4)}@drv.test`, vehicle: 'ebike' });
    await expect(app.drivers.setOnline(u, true, at)).rejects.toMatchObject({ code: 'forbidden' });
    await app.admin.setDriverStatus(d.id, 'approved');
    await expect(app.drivers.setOnline(u, true, at)).rejects.toMatchObject({ code: 'payouts_not_ready' });
    app.fake.drivers.get(d.id)!.ready = true;
    expect(await app.drivers.stripeOverview(u)).toMatchObject({ kind: 'driver', statement: [{ payCents: 780, tipCents: 540 }] });
    expect(app.fake.callsTo('stripeOverview').at(-1)!.args).toEqual(['driver', d.id]);
    await app.drivers.setOnline(u, true, at);
    return { u, d };
  }

  it('offer shows distance, time and pay; accepting locks it; delivery pays exactly that plus the full tip', async () => {
    const app = build();
    const s = await liveRestaurant(app);
    const { u, d } = await onlineDriver(app);
    const cu = await customerWithAddress(app);
    const { orderId, paymentsOrderId } = await placedOrder(app, s, cu);
    await app.orders.accept(s.owner, orderId);

    const [offer] = await app.drivers.openOffers(u);
    expect(offer.orderIds).toEqual([orderId]);
    expect(offer.distanceMeters).toBeGreaterThan(0);
    expect(offer.durationSeconds).toBeGreaterThan(0);
    expect(offer.payCents).toBeGreaterThanOrEqual(250);
    // Locked pay = delivery fee − card share − payout cost = the courier price frozen at checkout.
    const placed = await app.state.load(orderId);
    expect(offer.payCents).toBe((placed.deliveryQuote as { feeCents: number }).feeCents);
    expect(app.uber.calls.filter((c) => c.op === 'create')).toHaveLength(0);
    // Drivers see only their own locked pay: never the customer's delivery fee, the markup or the courier quote.
    expect(JSON.stringify(offer)).not.toMatch(/markup|courierCents|providerQuote|feeCents|deliveryCents|uber|doordash/i);

    await app.drivers.acceptOffer(u, offer.id);
    await expect(app.drivers.acceptOffer(u, offer.id)).rejects.toMatchObject({ code: 'offer_gone' });
    await app.orders.markReady(s.owner, orderId);
    await app.drivers.arrivedAtPickup(u, orderId);
    await app.drivers.pickedUp(u, orderId);
    // Customer sees the courier's first name only.
    expect((await app.orders.customerOrder(cu.c, orderId)).delivery?.courier?.firstName).toBe('Rahim');
    await app.drivers.delivered(u, orderId);
    await app.drivers.delivered(u, orderId); // repeat is harmless

    expect((await app.state.load(orderId)).status).toBe('delivered');
    expect(app.fake.callsTo('ownDriverDelivered')).toEqual([{ method: 'ownDriverDelivered', args: [paymentsOrderId, d.id, offer.payCents] }]);
    const week = await app.drivers.earnings(u);
    expect(week).toMatchObject({ trips: 1, payCents: offer.payCents, tipsCents: 400 });
    expect(JSON.stringify(week)).not.toMatch(/markup|courierCents|providerQuote|feeCents|deliveryCents/i);
  });

  it('two orders from the same restaurant to nearby addresses become one offer', async () => {
    const app = build();
    const s = await liveRestaurant(app);
    const { u } = await onlineDriver(app);
    // Keep the engine from offering the first order before the second arrives.
    await app.drivers.setOnline(u, false);
    const c1 = await customerWithAddress(app, '+19175550201', { lat: 40.7484, lng: -73.9857 });
    const c2 = await customerWithAddress(app, '+19175550202', { lat: 40.7505, lng: -73.9934 });
    const o1 = await placedOrder(app, s, c1, 'key-batch-001');
    const o2 = await placedOrder(app, s, c2, 'key-batch-002');
    await db.insert(t.deliveries).values([{ orderId: o1.orderId, provider: 'own_driver' }, { orderId: o2.orderId, provider: 'own_driver' }]);
    await db.update(t.orders).set({ status: 'accepted' });
    await app.drivers.setOnline(u, true, { lat: 40.7420, lng: -73.9890 });

    const offers = await app.drivers.openOffers(u);
    expect(offers).toHaveLength(1);
    expect(offers[0].orderIds.sort()).toEqual([o1.orderId, o2.orderId].sort());
    const per = offers[0].payPerOrder;
    expect(per[o1.orderId] + per[o2.orderId]).toBe(offers[0].payCents);
  });

  it('a declined offer goes to the next driver; nobody accepting hands the order to a courier company', async () => {
    const app = build();
    const s = await liveRestaurant(app);
    const a = await onlineDriver(app, '+19175550401', { lat: 40.7415, lng: -73.9895 });
    const b = await onlineDriver(app, '+19175550402', { lat: 40.7450, lng: -73.9880 });
    const cu = await customerWithAddress(app);
    const { orderId } = await placedOrder(app, s, cu);
    await app.orders.accept(s.owner, orderId);

    const [first] = await app.drivers.openOffers(a.u);
    await app.drivers.declineOffer(a.u, first.id);
    const [second] = await app.drivers.openOffers(b.u);
    expect(second.orderIds).toEqual([orderId]);
    await app.drivers.declineOffer(b.u, second.id);

    await db.update(t.deliveries).set({ createdAt: new Date(Date.now() - 10 * 60_000) }).where(eq(t.deliveries.orderId, orderId));
    const res = await app.dispatch.tick();
    expect(res.handedOff).toBe(1);
    const [del] = await db.select().from(t.deliveries).where(eq(t.deliveries.orderId, orderId));
    expect(del.provider).toBe('uber_direct');
  });
});

describe('pickup orders', () => {
  it('no delivery fee, no tip line, completed when collected', async () => {
    const app = build();
    const s = await liveRestaurant(app);
    const cu = await customerWithAddress(app);
    const input = { locationId: s.loc.id, fulfilment: 'pickup' as const, lines: [{ itemId: s.item.id, quantity: 1, optionIds: [s.raita.id] }], tipCents: 300 };
    const p = await app.orders.preview(cu.c, input);
    expect(p.receipt.lines.map((l) => l.kind)).toEqual(['food', 'fee', 'tax']);
    const placed = await app.orders.place(cu.c, { ...input, idempotencyKey: 'key-pickup-01', expectedTotalCents: p.receipt.totalCents });
    const [row] = await db.select().from(t.orders).where(eq(t.orders.id, placed.order.id));
    app.fake.authorize(row.paymentsOrderId!);
    await app.orders.confirmPayment(cu.c, row.id);
    await app.orders.accept(s.owner, row.id);
    await app.orders.markCollected(s.owner, row.id);
    expect((await app.state.load(row.id)).status).toBe('completed');
    expect(await db.select().from(t.deliveries)).toHaveLength(0);
  });
});
