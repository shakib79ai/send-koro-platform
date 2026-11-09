/**
 * Own drivers. Connected Stripe accounts like restaurants; no subscription and no fees (rule 6).
 * Offers are upfront and locked: the pay accepted is the pay transferred, plus 100% of the tip,
 * never reduced for traffic or delays. The NYC minimum-pay check runs weekly on top.
 */
import { and, desc, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { deliveries, driverOffers, drivers, driverTrips, orders } from '../db/schema';
import { nycWeeklyTopUpCents } from '../core/rate-card';
import { badRequest, conflict, forbidden, notFound } from '../common/http';
import type { PaymentsClient } from '../integrations/payments.client';
import type { AuthUser } from '../auth/auth.guard';
import type { DispatchService } from '../dispatch/dispatch.service';
import type { OrderStateService } from '../orders/order-state.service';
import type { NotificationsService } from '../notifications/notifications.service';

const ACTIVE = ['assigned', 'at_pickup', 'picked_up', 'at_dropoff'] as const;

/** Monday 00:00 of the New York week containing `at`, as YYYY-MM-DD, plus its UTC bounds. */
export function nyWeek(at: Date) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' });
  const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
  const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(p.weekday);
  const localMidnight = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)) - dow * 86_400_000;
  const monday = new Date(localMidnight).toISOString().slice(0, 10);
  // Convert NY local midnight to UTC (EST −5 / EDT −4): check the offset at that instant.
  const offsetAt = (ms: number) => {
    const s = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'shortOffset' }).formatToParts(new Date(ms)).find((x) => x.type === 'timeZoneName')!.value;
    return Number(s.replace('GMT', '') || 0);
  };
  const start = new Date(localMidnight - offsetAt(localMidnight + 12 * 3600_000) * 3600_000);
  const endLocal = localMidnight + 7 * 86_400_000;
  const end = new Date(endLocal - offsetAt(endLocal + 12 * 3600_000) * 3600_000);
  return { weekStart: monday, start, end };
}

export class DriversService {
  constructor(
    private readonly db: Db,
    private readonly payments: PaymentsClient,
    private readonly dispatch: DispatchService,
    private readonly state: OrderStateService,
    private readonly notify: NotificationsService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async me(user: AuthUser) {
    let [d] = await this.db.select().from(drivers).where(eq(drivers.userId, user.id));
    if (!d) return null;
    if (!d.payoutsReady) {
      const st = await this.payments.driverStatus(d.id).catch(() => null);
      if (st?.ready) [d] = await this.db.update(drivers).set({ payoutsReady: true }).where(eq(drivers.id, d.id)).returning();
    }
    return d;
  }

  private async driver(user: AuthUser) {
    const [d] = await this.db.select().from(drivers).where(eq(drivers.userId, user.id));
    if (!d) throw notFound('Driver profile');
    return d;
  }

  async apply(user: AuthUser, input: { name: string; email: string; vehicle: string }) {
    const [d] = await this.db.insert(drivers).values({ userId: user.id, ...input })
      .onConflictDoUpdate({ target: drivers.userId, set: { name: input.name, email: input.email, vehicle: input.vehicle } }).returning();
    await this.payments.upsertDriver({ id: d.id, name: d.name, contactEmail: d.email });
    return d;
  }

  async payoutsLink(user: AuthUser) {
    const d = await this.driver(user);
    return this.payments.driverOnboardingLink(d.id);
  }

  async stripeOverview(user: AuthUser) {
    const d = await this.driver(user);
    return this.payments.stripeOverview('driver', d.id);
  }

  async stripeAccountSession(user: AuthUser) {
    const d = await this.driver(user);
    return this.payments.stripeAccountSession('driver', d.id);
  }

  async setOnline(user: AuthUser, online: boolean, at?: { lat: number; lng: number }) {
    const d = (await this.me(user)) ?? (() => { throw notFound('Driver profile'); })();
    if (online) {
      if (d.status !== 'approved') throw forbidden('Your account is waiting for approval');
      if (!d.payoutsReady) throw conflict('payouts_not_ready', 'Set up payouts with Stripe before going online');
    }
    const [row] = await this.db.update(drivers).set({ online, ...(at ? { lat: at.lat, lng: at.lng, locationAt: this.now() } : {}) }).where(eq(drivers.id, d.id)).returning();
    if (online) await this.dispatch.tick();
    return row;
  }

  async updateLocation(user: AuthUser, at: { lat: number; lng: number }) {
    const d = await this.driver(user);
    await this.db.update(drivers).set({ lat: at.lat, lng: at.lng, locationAt: this.now() }).where(eq(drivers.id, d.id));
    const active = await this.db.select({ orderId: deliveries.orderId }).from(deliveries).where(and(eq(deliveries.driverId, d.id), inArray(deliveries.status, [...ACTIVE])));
    for (const a of active) this.notify.live(`order:${a.orderId}`, 'courier.location', at);
    return { ok: true };
  }

  async openOffers(user: AuthUser) {
    const d = await this.driver(user);
    return this.db.select().from(driverOffers).where(and(eq(driverOffers.driverId, d.id), eq(driverOffers.status, 'open'), gte(driverOffers.expiresAt, this.now())));
  }

  /** Accepting locks the pay. Only one accept per batch can win (partial unique index). */
  async acceptOffer(user: AuthUser, offerId: string) {
    const d = await this.driver(user);
    return this.db.transaction(async (tx) => {
      const [offer] = await tx.update(driverOffers).set({ status: 'accepted', respondedAt: this.now() })
        .where(and(eq(driverOffers.id, offerId), eq(driverOffers.driverId, d.id), eq(driverOffers.status, 'open'), gte(driverOffers.expiresAt, this.now()))).returning();
      if (!offer) throw conflict('offer_gone', 'This offer is no longer available');
      for (const orderId of offer.orderIds) {
        const [row] = await tx.update(deliveries).set({
          driverId: d.id, status: 'assigned', batchId: offer.batchId, driverPayCents: offer.payPerOrder[orderId],
          distanceMeters: offer.distanceMeters, durationSeconds: offer.durationSeconds,
        }).where(and(eq(deliveries.orderId, orderId), eq(deliveries.provider, 'own_driver'), isNull(deliveries.driverId))).returning();
        if (!row) throw conflict('offer_gone', 'An order on this offer was reassigned');
      }
      await tx.insert(driverTrips).values({ driverId: d.id, batchId: offer.batchId, startedAt: this.now(), payCents: offer.payCents });
      for (const orderId of offer.orderIds) await this.state.log(orderId, 'dispatch.driver_accepted', `driver:${d.id}`, { payCents: offer.payPerOrder[orderId] });
      return offer;
    }).then((offer) => {
      for (const id of offer.orderIds) this.notify.live(`order:${id}`, 'courier.assigned', { firstName: d.name.split(' ')[0] });
      this.notify.live('admin', 'delivery.assigned', { orderIds: offer.orderIds, provider: 'own_driver', driverId: d.id });
      return offer;
    });
  }

  async declineOffer(user: AuthUser, offerId: string) {
    const d = await this.driver(user);
    const [offer] = await this.db.update(driverOffers).set({ status: 'declined', respondedAt: this.now() })
      .where(and(eq(driverOffers.id, offerId), eq(driverOffers.driverId, d.id), eq(driverOffers.status, 'open'))).returning();
    if (!offer) throw conflict('offer_gone', 'This offer is no longer available');
    await this.dispatch.releaseOrders(offer.orderIds);
    await this.dispatch.tick();
    return { ok: true };
  }

  async currentTrip(user: AuthUser) {
    const d = await this.driver(user);
    const rows = await this.db.select({ del: deliveries, o: orders }).from(deliveries).innerJoin(orders, eq(orders.id, deliveries.orderId))
      .where(and(eq(deliveries.driverId, d.id), inArray(deliveries.status, [...ACTIVE])));
    const out = [];
    for (const { del, o } of rows) {
      const pickup = await this.dispatch.pickupStop(o);
      const dropoff = await this.dispatch.dropoffStop(o);
      out.push({
        orderId: o.id, code: o.code, status: del.status, orderStatus: o.status, payCents: del.driverPayCents, tipCents: o.tipCents,
        pickup, dropoff, items: (o.items as { name: string; quantity: number }[]).map((i) => ({ name: i.name, quantity: i.quantity })),
      });
    }
    return out;
  }

  private async myDelivery(user: AuthUser, orderId: string) {
    const d = await this.driver(user);
    const [del] = await this.db.select().from(deliveries).where(and(eq(deliveries.orderId, orderId), eq(deliveries.driverId, d.id)));
    if (!del) throw notFound('Delivery');
    return { d, del };
  }

  async arrivedAtPickup(user: AuthUser, orderId: string) {
    const { del } = await this.myDelivery(user, orderId);
    if (del.status !== 'assigned') return del;
    const [row] = await this.db.update(deliveries).set({ status: 'at_pickup' }).where(eq(deliveries.id, del.id)).returning();
    const o = await this.state.load(orderId);
    this.notify.live(`restaurant:${o.restaurantId}`, 'courier.arrived', { orderId, code: o.code });
    return row;
  }

  async pickedUp(user: AuthUser, orderId: string) {
    const { d, del } = await this.myDelivery(user, orderId);
    if (!['assigned', 'at_pickup'].includes(del.status)) return del;
    const o = await this.state.load(orderId);
    if (!['accepted', 'preparing', 'ready'].includes(o.status)) throw conflict('invalid_transition', `Order is ${o.status}`);
    if (o.status !== 'ready') await this.state.transition(o.id, 'ready', `driver:${d.id}`);
    await this.state.transition(o.id, 'picked_up', `driver:${d.id}`);
    const [row] = await this.db.update(deliveries).set({ status: 'picked_up', pickedUpAt: this.now() }).where(eq(deliveries.id, del.id)).returning();
    return row;
  }

  /**
   * Delivered → the payments service transfers locked pay + 100% tip once (idempotent per order).
   * Example: offer $12.10 + $4.00 tip → one transfer of 1610 to the driver's Stripe account.
   */
  async delivered(user: AuthUser, orderId: string, proofPhotoUrl?: string) {
    const { d, del } = await this.myDelivery(user, orderId);
    if (del.status === 'delivered') return del;
    if (del.status !== 'picked_up' && del.status !== 'at_dropoff') throw badRequest('not_picked_up', 'Mark the order picked up first');
    const o = await this.state.load(orderId);
    const [row] = await this.db.update(deliveries).set({ status: 'delivered', deliveredAt: this.now(), proofPhotoUrl }).where(eq(deliveries.id, del.id)).returning();
    await this.state.transition(o.id, 'delivered', `driver:${d.id}`);
    await this.payments.ownDriverDelivered(o.paymentsOrderId!, d.id, del.driverPayCents ?? 0);
    if (del.batchId) {
      const left = await this.db.select({ id: deliveries.id }).from(deliveries).where(and(eq(deliveries.batchId, del.batchId), inArray(deliveries.status, [...ACTIVE])));
      if (!left.length) await this.db.update(driverTrips).set({ endedAt: this.now() }).where(and(eq(driverTrips.batchId, del.batchId), isNull(driverTrips.endedAt)));
    }
    return row;
  }

  /** This week's pay, tips and the NYC minimum check (tips never count toward the minimum). */
  async earnings(user: AuthUser, at = this.now()) {
    const d = await this.driver(user);
    return this.weekSummary(d.id, at);
  }

  async weekSummary(driverId: string, at: Date) {
    const w = nyWeek(at);
    const trips = await this.db.select().from(driverTrips).where(and(eq(driverTrips.driverId, driverId), gte(driverTrips.startedAt, w.start), lt(driverTrips.startedAt, w.end)));
    const done = trips.filter((t) => t.endedAt);
    const nyc = nycWeeklyTopUpCents(done.map((t) => ({ durationSeconds: Math.round((t.endedAt!.getTime() - t.startedAt.getTime()) / 1000), payCents: t.payCents })));
    const [{ tips }] = await this.db.select({ tips: sql<number>`coalesce(sum(${orders.tipCents}), 0)::int` }).from(deliveries).innerJoin(orders, eq(orders.id, deliveries.orderId))
      .where(and(eq(deliveries.driverId, driverId), eq(deliveries.status, 'delivered'), gte(deliveries.deliveredAt, w.start), lt(deliveries.deliveredAt, w.end)));
    const tripSeconds = done.reduce((a, t) => a + Math.round((t.endedAt!.getTime() - t.startedAt.getTime()) / 1000), 0);
    return { weekStart: w.weekStart, trips: done.length, tripSeconds, payCents: nyc.paidCents, tipsCents: tips, nycMinimumCents: nyc.minimumCents, nycTopUpCents: nyc.topUpCents };
  }

  /** Monday job: settle last week's NYC minimum-pay top-ups through the payments service. */
  async settleLastWeekTopUps(at = this.now()) {
    const lastWeek = nyWeek(new Date(nyWeek(at).start.getTime() - 3600_000));
    const rows = await this.db.selectDistinct({ driverId: driverTrips.driverId }).from(driverTrips).where(and(gte(driverTrips.startedAt, lastWeek.start), lt(driverTrips.startedAt, lastWeek.end)));
    const results = [];
    for (const { driverId } of rows) {
      const s = await this.weekSummary(driverId, lastWeek.start);
      results.push({ driverId, ...(await this.payments.nycWeeklyTopUp(driverId, { weekStart: s.weekStart, tripSeconds: s.tripSeconds, paidCents: s.payCents })) });
    }
    return results;
  }

  async history(user: AuthUser) {
    const d = await this.driver(user);
    return this.db.select({ orderId: deliveries.orderId, code: orders.code, payCents: deliveries.driverPayCents, tipCents: orders.tipCents, deliveredAt: deliveries.deliveredAt, distanceMeters: deliveries.distanceMeters })
      .from(deliveries).innerJoin(orders, eq(orders.id, deliveries.orderId)).where(and(eq(deliveries.driverId, d.id), eq(deliveries.status, 'delivered'))).orderBy(desc(deliveries.deliveredAt)).limit(200);
  }
}
