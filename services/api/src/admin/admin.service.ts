/** Admin console backend: operations, restaurants, drivers, orders, refunds, dispatch retries. */
import { and, desc, eq, gte, ilike, or, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { deliveries, driverOffers, drivers, locations, orderEvents, orders, restaurants, users } from '../db/schema';
import { BLOCKED_STATES, LAUNCH_STATES } from '../core/tax';
import { badRequest, notFound } from '../common/http';
import type { PaymentsClient } from '../integrations/payments.client';
import type { DispatchService } from '../dispatch/dispatch.service';
import type { OrderStateService } from '../orders/order-state.service';

export interface IntegrationConfig { uberDirect: string; doordashDrive: string; dispatchOrder: string; sms: string; push: string }

export class AdminService {
  constructor(private readonly db: Db, private readonly payments: PaymentsClient, private readonly dispatch: DispatchService, private readonly state: OrderStateService, private readonly integrations: IntegrationConfig = { uberDirect: 'mock', doordashDrive: 'mock', dispatchOrder: '', sms: 'console', push: 'console' }) {}

  /** Which courier and messaging integrations are on, in which mode, and recent delivery volume per provider. */
  async integrationStatus() {
    const since = new Date(Date.now() - 7 * 86_400_000);
    const rows = await this.db.select({ provider: deliveries.provider, status: deliveries.status, n: sql<number>`count(*)::int` }).from(deliveries).where(gte(deliveries.createdAt, since)).groupBy(deliveries.provider, deliveries.status);
    const [dr] = await this.db.select({ online: sql<number>`count(*) filter (where ${drivers.online})::int`, approved: sql<number>`count(*) filter (where ${drivers.status} = 'approved')::int`, pending: sql<number>`count(*) filter (where ${drivers.status} = 'applied')::int` }).from(drivers);
    return {
      paymentsServiceUp: await this.payments.health(),
      providers: [
        { key: 'uber_direct', name: 'Uber Direct', role: 'Primary', mode: this.integrations.uberDirect },
        { key: 'doordash_drive', name: 'DoorDash Drive', role: 'Backup', mode: this.integrations.doordashDrive },
        { key: 'own_driver', name: 'Send Koro drivers', role: 'Own fleet', mode: 'live', drivers: dr },
      ],
      dispatchOrder: this.integrations.dispatchOrder.split(','),
      sms: this.integrations.sms, push: this.integrations.push,
      last7Days: rows,
    };
  }

  /** Tax & compliance: every restaurant's tax acceptance and location rates; launch states policy. */
  async taxCompliance() {
    const rs = await this.db.select().from(restaurants).orderBy(restaurants.name);
    const ls = await this.db.select().from(locations);
    return {
      policy: { launchStates: [...LAUNCH_STATES], blockedStates: BLOCKED_STATES, platformCollectsTax: false },
      restaurants: rs.map((r) => ({
        id: r.id, name: r.name, status: r.status, taxResponsibilityAcceptedAt: r.taxResponsibilityAcceptedAt,
        locations: ls.filter((l) => l.restaurantId === r.id).map((l) => ({ id: l.id, name: l.name, state: l.state, postalCode: l.postalCode, taxRatePpm: l.taxRatePpm })),
      })),
    };
  }

  /** Money views come from the payments service (charges live on each restaurant's own Stripe account). */
  money<T = unknown>(path: string, query?: Record<string, string | undefined>) { return this.payments.admin<T>(path, query); }
  moneyAction<T = unknown>(path: string, body?: unknown) { return this.payments.adminPost<T>(path, body); }

  async overview(since = new Date(Date.now() - 86_400_000)) {
    const [o] = await this.db.select({
      orders: sql<number>`count(*)::int`,
      food: sql<number>`coalesce(sum(${orders.foodCents}) filter (where ${orders.status} in ('accepted','preparing','ready','picked_up','delivered','completed')), 0)::int`,
      live: sql<number>`count(*) filter (where ${orders.status} in ('placed','accepted','preparing','ready','picked_up'))::int`,
      declined: sql<number>`count(*) filter (where ${orders.status} = 'declined')::int`,
    }).from(orders).where(gte(orders.createdAt, since));
    const byProvider = await this.db.select({ provider: deliveries.provider, n: sql<number>`count(*)::int` }).from(deliveries).where(gte(deliveries.createdAt, since)).groupBy(deliveries.provider);
    const [dr] = await this.db.select({ online: sql<number>`count(*) filter (where ${drivers.online})::int`, approved: sql<number>`count(*) filter (where ${drivers.status} = 'approved')::int` }).from(drivers);
    return { since, orders: o.orders, liveOrders: o.live, declinedOrders: o.declined, foodSalesCents: o.food, deliveriesByProvider: byProvider, driversOnline: dr.online, driversApproved: dr.approved };
  }

  restaurants(q?: string) {
    return this.db.select().from(restaurants).where(q ? ilike(restaurants.name, `%${q}%`) : undefined).orderBy(desc(restaurants.createdAt)).limit(200);
  }

  async setRestaurantStatus(id: string, status: 'live' | 'paused' | 'suspended', actor: string) {
    const [r] = await this.db.update(restaurants).set({ status }).where(eq(restaurants.id, id)).returning();
    if (!r) throw notFound('Restaurant');
    return { ...r, changedBy: actor };
  }

  drivers(status?: 'applied' | 'approved' | 'suspended') {
    return this.db.select().from(drivers).where(status ? eq(drivers.status, status) : undefined).orderBy(desc(drivers.createdAt)).limit(500);
  }

  async setDriverStatus(id: string, status: 'approved' | 'suspended') {
    const [d] = await this.db.update(drivers).set({ status, ...(status === 'suspended' ? { online: false } : {}) }).where(eq(drivers.id, id)).returning();
    if (!d) throw notFound('Driver');
    return d;
  }

  orders(q: { status?: string; search?: string; limit?: number }) {
    const where = [];
    if (q.status) where.push(sql`${orders.status} = ${q.status}`);
    if (q.search) where.push(or(ilike(orders.code, `%${q.search}%`), sql`${orders.id}::text = ${q.search}`));
    return this.db.select({ o: orders, restaurantName: restaurants.name }).from(orders).innerJoin(restaurants, eq(restaurants.id, orders.restaurantId))
      .where(where.length ? and(...where) : undefined).orderBy(desc(orders.createdAt)).limit(q.limit ?? 100)
      .then((rows) => rows.map(({ o, restaurantName }) => ({ ...o, restaurantName })));
  }

  /** Full detail including the courier company — admin only. */
  async order(id: string) {
    const o = await this.state.load(id);
    const [d] = await this.db.select().from(deliveries).where(eq(deliveries.orderId, id));
    const events = await this.db.select().from(orderEvents).where(eq(orderEvents.orderId, id)).orderBy(orderEvents.createdAt);
    const offers = await this.db.select().from(driverOffers).where(sql`${driverOffers.orderIds} @> ${JSON.stringify([id])}::jsonb`);
    const [customer] = await this.db.select({ id: users.id, name: users.name, phone: users.phone }).from(users).where(eq(users.id, o.customerId));
    return { order: o, delivery: d ?? null, events, offers, customer };
  }

  /** Component refund through the payments service; requestId makes retries safe. */
  async refund(id: string, body: { requestId: string; reason: string; foodCents?: number; serviceChargeCents?: number; taxCents?: number; customerDeliveryCents?: number; restoreSubsidyCents?: number; tipCents?: number }, actor: string) {
    const o = await this.state.load(id);
    if (!o.paymentsOrderId) throw badRequest('not_paid', 'This order was never paid');
    const res = await this.payments.refund(o.paymentsOrderId, body);
    await this.state.log(o.id, 'refund.requested', actor, body);
    return res;
  }

  async retryDispatch(id: string, actor: string) {
    const o = await this.state.load(id);
    if (o.fulfilment !== 'delivery' || !['accepted', 'preparing', 'ready'].includes(o.status)) throw badRequest('not_dispatchable', `Order is ${o.status}`);
    await this.state.log(o.id, 'dispatch.retry', actor);
    return this.dispatch.sendToThirdParty(o, 'admin retry');
  }

  async addAdmin(phone: string, name: string) {
    const [u] = await this.db.insert(users).values({ phone, role: 'admin', name }).onConflictDoUpdate({ target: [users.phone, users.role], set: { name, disabledAt: null } }).returning();
    return { id: u.id, phone: u.phone, name: u.name };
  }

  async setUserDisabled(userId: string, disabled: boolean) {
    const [u] = await this.db.update(users).set({ disabledAt: disabled ? new Date() : null }).where(eq(users.id, userId)).returning();
    if (!u) throw notFound('User');
    return { id: u.id, disabled };
  }
}
