/**
 * Dispatch: price a delivery at checkout and fulfil it after the restaurant accepts.
 *
 *  • Delivery price = the Uber Direct quote (DoorDash Drive as backup), including for own drivers
 *    (BUSINESS_MODEL.md §Fulfilment).
 *  • After acceptance: if an approved, online, payout-ready own driver is near the pickup, the order
 *    goes to the own-driver offer engine (upfront, locked pay; two orders on one route when they fit).
 *    Otherwise — or if no driver accepts within OWN_DRIVER_WAIT — it goes to the third-party provider,
 *    with the full tip sent through the provider's tip field.
 *  • Customers never see which company delivers (rule 4). Provider names live only in admin views.
 */
import { randomUUID } from 'node:crypto';
import { and, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { addresses, deliveries, driverOffers, drivers, locations, orders, restaurants, users } from '../db/schema';
import { haversineMeters, Point } from '../core/geo';
import { planOffers, PendingDelivery, PlannedOffer } from '../core/batching';
import type { PaymentsClient } from '../integrations/payments.client';
import type { DeliveryProviderAdapter, ProviderDelivery, ProviderQuote, Stop, ThirdPartyProvider } from './providers/types';
import { providersForStrategy, type DispatchProvider } from './dispatch-strategy';
import type { NotificationsService } from '../notifications/notifications.service';
import type { Order, OrderStateService } from '../orders/order-state.service';

export const DISPATCH_TIMING = {
  offerSeconds: 45,
  /** How long to look for an own driver before handing the order to a third-party courier. */
  ownDriverWaitSeconds: 240,
  /** Own drivers are offered orders within this distance of the pickup. */
  driverRadiusMeters: 3000,
  /** Location older than this means the driver's app is not really online. */
  driverFreshSeconds: 120,
} as const;

export class DispatchService {
  private readonly order: DispatchProvider[];

  constructor(
    private readonly db: Db,
    private readonly providers: Partial<Record<ThirdPartyProvider, DeliveryProviderAdapter>>,
    private readonly payments: PaymentsClient,
    private readonly state: OrderStateService,
    private readonly notify: NotificationsService,
    dispatchOrder: string,
    private readonly now: () => Date = () => new Date(),
  ) {
    this.order = dispatchOrder.split(',').map((s) => s.trim()).filter((s): s is DispatchProvider => ['own_driver', 'uber_direct', 'doordash_drive'].includes(s));
  }

  private sequence(o: Order): DispatchProvider[] {
    return providersForStrategy(o.dispatchStrategy, this.order);
  }

  private thirdParty(order: readonly DispatchProvider[] = this.order): DeliveryProviderAdapter[] {
    return order.filter((p): p is ThirdPartyProvider => p !== 'own_driver').map((p) => this.providers[p]).filter((p): p is DeliveryProviderAdapter => !!p);
  }

  /** Checkout price: first third-party provider that quotes. */
  async quotePrice(pickup: Stop, dropoff: Stop, orderValueCents: number): Promise<ProviderQuote> {
    const errors: string[] = [];
    for (const p of this.thirdParty()) {
      try { return await p.quote({ externalId: `cart-${randomUUID()}`, pickup, dropoff, orderValueCents }); } catch (e) { errors.push(`${p.name}: ${(e as Error).message}`); }
    }
    throw new Error(`No delivery quote available (${errors.join('; ') || 'no providers configured'})`);
  }

  /** Called once the restaurant has accepted (card captured). Idempotent per order. */
  async start(o: Order) {
    if (o.fulfilment !== 'delivery') return null;
    const [existing] = await this.db.select().from(deliveries).where(eq(deliveries.orderId, o.id));
    if (existing) {
      if (existing.status === 'failed' && !existing.providerDispatchStartedAt) {
        return this.sendToThirdParty(o, 'retrying after provider failure', this.sequence(o));
      }
      return existing;
    }
    const sequence = this.sequence(o);
    const loc = await this.location(o.locationId);
    if (sequence[0] === 'own_driver' && ((await this.nearbyDrivers(loc)).length || sequence.length === 1)) {
      const [d] = await this.db.insert(deliveries).values({ orderId: o.id, provider: 'own_driver', status: 'requested' }).onConflictDoNothing().returning();
      if (d) await this.state.log(o.id, 'dispatch.own_driver_requested', 'system');
      await this.tick();
      return d ?? (await this.db.select().from(deliveries).where(eq(deliveries.orderId, o.id)))[0];
    }
    const remaining = sequence[0] === 'own_driver' ? sequence.slice(1) : sequence;
    return this.sendToThirdParty(o, 'no own driver available', remaining);
  }

  /**
   * Reserves the order for one third-party provider before calling it. Quote failures may try the
   * next configured provider; a delivery-create failure is treated as uncertain and never races a
   * second provider against a possibly-created delivery.
   */
  async sendToThirdParty(o: Order, reason = 'no own driver available', providerOrder: readonly DispatchProvider[] = this.sequence(o)) {
    let [cur] = await this.db.select().from(deliveries).where(eq(deliveries.orderId, o.id));
    if (cur?.driverId) return cur;
    if (cur && cur.provider !== 'own_driver' && !['failed', 'cancelled'].includes(cur.status)) {
      if (cur.status !== 'requested' || cur.providerDispatchStartedAt) return cur;
    }
    const pickup = await this.pickupStop(o);
    const dropoff = await this.dropoffStop(o);
    const errors: string[] = [];

    for (const p of this.thirdParty(providerOrder)) {
      let claimed: typeof deliveries.$inferSelect | undefined;
      if (cur) {
        [claimed] = await this.db.update(deliveries).set({
          provider: p.name, providerDeliveryId: null, status: 'requested', trackingUrl: null,
          providerQuoteCents: null, driverPayCents: null, providerDispatchStartedAt: this.now(),
        }).where(and(
          eq(deliveries.id, cur.id), isNull(deliveries.driverId), isNull(deliveries.providerDispatchStartedAt),
          inArray(deliveries.status, ['requested', 'offered', 'failed', 'cancelled']),
        )).returning();
      } else {
        [claimed] = await this.db.insert(deliveries).values({
          orderId: o.id, provider: p.name, status: 'requested', providerDispatchStartedAt: this.now(),
        }).onConflictDoNothing().returning();
      }
      if (!claimed) return (await this.db.select().from(deliveries).where(eq(deliveries.orderId, o.id)))[0] ?? null;
      cur = claimed;
      await this.db.update(driverOffers).set({ status: 'withdrawn' }).where(and(
        eq(driverOffers.status, 'open'),
        sql`${driverOffers.orderIds} @> ${JSON.stringify([o.id])}::jsonb`,
      ));

      let q: ProviderQuote;
      try {
        q = await p.quote({ externalId: o.id, pickup, dropoff, orderValueCents: o.foodCents });
      } catch (e) {
        errors.push(`${p.name}: ${(e as Error).message}`);
        await this.db.update(deliveries).set({ providerDispatchStartedAt: null }).where(eq(deliveries.id, claimed.id));
        continue;
      }

      let created: ProviderDelivery;
      try {
        created = await p.create({
          externalId: o.id, quoteId: q.quoteId, pickup, dropoff, orderValueCents: o.foodCents,
          tipCents: o.tipCents, // 100% of the tip, through the provider's tip field
          items: (o.items as { name: string; quantity: number }[]).map((i) => ({ name: i.name, quantity: i.quantity })),
        });
      } catch (e) {
        await this.db.update(deliveries).set({ status: 'failed' }).where(eq(deliveries.id, claimed.id));
        await this.state.log(o.id, 'dispatch.provider_create_uncertain', 'system', { provider: p.name });
        this.notify.live('admin', 'delivery.failed', { orderId: o.id, provider: p.name, uncertain: true });
        throw new Error(`Could not confirm ${p.name} delivery creation; automatic fallback stopped to avoid duplicate fulfillment.`);
      }

      const [row] = await this.db.update(deliveries).set({
        provider: p.name, providerDeliveryId: created.providerDeliveryId, status: 'assigned',
        trackingUrl: created.trackingUrl, providerQuoteCents: created.feeCents ?? q.feeCents,
        driverId: null, driverPayCents: null,
      }).where(eq(deliveries.id, claimed.id)).returning();
      await this.state.log(o.id, 'dispatch.third_party_assigned', 'system', { provider: p.name, reason });
      if (o.paymentsOrderId) {
        await this.payments.supplierAssigned(o.paymentsOrderId, p.name, created.providerDeliveryId);
        if (o.tipCents > 0) await this.payments.supplierTipSubmitted(o.paymentsOrderId);
      }
      this.notify.live('admin', 'delivery.assigned', { orderId: o.id, provider: p.name });
      return row;
    }

    if (cur) await this.db.update(deliveries).set({ status: 'failed', providerDispatchStartedAt: null }).where(eq(deliveries.id, cur.id));
    await this.state.log(o.id, 'dispatch.failed', 'system', { errors });
    this.notify.live('admin', 'delivery.failed', { orderId: o.id, errors });
    throw new Error(`Could not assign a courier: ${errors.join('; ')}`);
  }

  /**
   * Offer engine, run every few seconds by the jobs and right after an order is requested:
   * expire stale offers, hand long-waiting orders to third parties, and offer the rest to drivers.
   */
  async tick() {
    const now = this.now();
    await this.db.update(driverOffers).set({ status: 'expired' }).where(and(eq(driverOffers.status, 'open'), lt(driverOffers.expiresAt, now)));

    const waiting = await this.db.select({ d: deliveries, o: orders }).from(deliveries).innerJoin(orders, eq(orders.id, deliveries.orderId))
      .where(and(eq(deliveries.provider, 'own_driver'), eq(deliveries.status, 'requested'), isNull(deliveries.driverId)));
    if (!waiting.length) return { offered: 0, handedOff: 0 };

    const openOffers = await this.db.select().from(driverOffers).where(eq(driverOffers.status, 'open'));
    const onOffer = new Set(openOffers.flatMap((x) => x.orderIds));
    let handedOff = 0;
    const pending: (PendingDelivery & { locationId: string })[] = [];
    for (const { d, o } of waiting) {
      if (now.getTime() - d.createdAt.getTime() > DISPATCH_TIMING.ownDriverWaitSeconds * 1000) {
        if (onOffer.has(o.id)) continue; // let the current offer run out first
        const sequence = this.sequence(o);
        const ownIndex = sequence.indexOf('own_driver');
        const fallback = ownIndex < 0 ? [] : sequence.slice(ownIndex + 1);
        if (fallback.some((provider) => provider !== 'own_driver')) {
          await this.sendToThirdParty(o, 'no own driver accepted in time', fallback).then(() => handedOff++).catch(() => undefined);
        } else {
          const [failed] = await this.db.update(deliveries).set({ status: 'failed' })
            .where(and(eq(deliveries.id, d.id), isNull(deliveries.driverId), eq(deliveries.status, 'requested'))).returning();
          if (failed) {
            await this.state.log(o.id, 'dispatch.failed', 'system', { reason: 'no driver accepted; no fallback provider selected' });
            this.notify.live('admin', 'delivery.failed', { orderId: o.id, reason: 'no driver accepted; no fallback provider selected' });
          }
        }
        continue;
      }
      if (onOffer.has(o.id)) continue;
      const loc = await this.location(o.locationId);
      const drop = o.dropoff as { lat: number; lng: number };
      pending.push({ orderId: o.id, pickup: loc, dropoff: drop, readyAt: o.readyAt, locationId: o.locationId, driverPayCents: (o.deliveryQuote as { feeCents?: number } | null)?.feeCents ?? null });
    }

    let offered = 0;
    const busyDrivers = new Set(openOffers.map((x) => x.driverId));
    for (const d of await this.activeTripDrivers()) busyDrivers.add(d);
    const byLocation = new Map<string, typeof pending>();
    for (const p of pending) byLocation.set(p.locationId, [...(byLocation.get(p.locationId) ?? []), p]);
    for (const [locationId, list] of byLocation) {
      const loc = await this.location(locationId);
      for (const plan of planOffers(list)) {
        const declined = await this.declinedDrivers(plan.orderIds);
        const driver = (await this.nearbyDrivers(loc)).find((x) => !busyDrivers.has(x.id) && !declined.has(x.id));
        if (!driver) continue;
        await this.createOffer(driver.id, plan);
        busyDrivers.add(driver.id);
        offered++;
      }
    }
    return { offered, handedOff };
  }

  private async createOffer(driverId: string, plan: PlannedOffer) {
    const batchId = randomUUID();
    const expiresAt = new Date(this.now().getTime() + DISPATCH_TIMING.offerSeconds * 1000);
    const [offer] = await this.db.insert(driverOffers).values({
      driverId, batchId, orderIds: plan.orderIds, distanceMeters: plan.distanceMeters, durationSeconds: plan.durationSeconds,
      payCents: plan.payCents, payPerOrder: plan.payPerOrder, expiresAt,
    }).returning();
    await this.db.update(deliveries).set({ status: 'offered' }).where(and(inArray(deliveries.orderId, plan.orderIds), eq(deliveries.status, 'requested')));
    const [drv] = await this.db.select().from(drivers).where(eq(drivers.id, driverId));
    this.notify.live(`driver:${driverId}`, 'offer.new', offer);
    if (drv) await this.notify.pushTo([drv.userId], { title: `New offer · $${(plan.payCents / 100).toFixed(2)}`, body: `${(plan.distanceMeters / 1609.344).toFixed(1)} mi · ${Math.ceil(plan.durationSeconds / 60)} min${plan.orderIds.length > 1 ? ' · 2 orders' : ''}`, data: { offerId: offer.id } });
    return offer;
  }

  /** Offers come back to 'requested' when declined or expired so the engine can re-offer. */
  async releaseOrders(orderIds: string[]) {
    await this.db.update(deliveries).set({ status: 'requested' }).where(and(inArray(deliveries.orderId, orderIds), eq(deliveries.status, 'offered'), isNull(deliveries.driverId)));
  }

  /** Status updates from Uber Direct / DoorDash Drive webhooks (already verified). */
  async providerUpdate(provider: ThirdPartyProvider, providerDeliveryId: string, status: 'assigned' | 'at_pickup' | 'picked_up' | 'at_dropoff' | 'delivered' | 'cancelled' | 'failed', trackingUrl?: string) {
    const [d] = await this.db.select().from(deliveries).where(and(eq(deliveries.provider, provider), eq(deliveries.providerDeliveryId, providerDeliveryId)));
    if (!d) return null;
    await this.db.update(deliveries).set({ status, trackingUrl: trackingUrl ?? d.trackingUrl, ...(status === 'picked_up' ? { pickedUpAt: this.now() } : {}), ...(status === 'delivered' ? { deliveredAt: this.now() } : {}) }).where(eq(deliveries.id, d.id));
    const o = await this.state.load(d.orderId);
    if (status === 'picked_up' && ['accepted', 'preparing', 'ready'].includes(o.status)) {
      if (o.status !== 'ready') await this.state.transition(o.id, 'ready', provider);
      await this.state.transition(o.id, 'picked_up', provider);
    }
    if (status === 'delivered' && o.status === 'picked_up') await this.state.transition(o.id, 'delivered', provider);
    if (status === 'cancelled' || status === 'failed') {
      await this.state.log(o.id, `dispatch.provider_${status}`, provider);
      this.notify.live('admin', 'delivery.problem', { orderId: o.id, provider, status });
    }
    return d;
  }

  // ── helpers ──
  private async location(id: string) {
    const [l] = await this.db.select().from(locations).where(eq(locations.id, id));
    return l;
  }

  async nearbyDrivers(at: Point) {
    const fresh = new Date(this.now().getTime() - DISPATCH_TIMING.driverFreshSeconds * 1000);
    const rows = await this.db.select().from(drivers).where(and(eq(drivers.online, true), eq(drivers.status, 'approved'), eq(drivers.payoutsReady, true), sql`${drivers.locationAt} > ${fresh}`));
    return rows
      .filter((d) => d.lat != null && d.lng != null)
      .map((d) => ({ ...d, distanceMeters: haversineMeters(at, { lat: d.lat!, lng: d.lng! }) }))
      .filter((d) => d.distanceMeters <= DISPATCH_TIMING.driverRadiusMeters)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  }

  private async activeTripDrivers() {
    const rows = await this.db.select({ driverId: deliveries.driverId }).from(deliveries)
      .where(and(eq(deliveries.provider, 'own_driver'), inArray(deliveries.status, ['assigned', 'at_pickup', 'picked_up', 'at_dropoff'])));
    return rows.map((r) => r.driverId!).filter(Boolean);
  }

  private async declinedDrivers(orderIds: string[]) {
    const rows = await this.db.select({ driverId: driverOffers.driverId, orderIds: driverOffers.orderIds }).from(driverOffers)
      .where(and(inArray(driverOffers.status, ['declined', 'expired']), sql`${driverOffers.orderIds} ?| array[${sql.join(orderIds.map((id) => sql`${id}`), sql`, `)}]::text[]`));
    return new Set(rows.map((r) => r.driverId));
  }

  async pickupStop(o: Order): Promise<Stop> {
    const [row] = await this.db.select({ l: locations, r: restaurants }).from(locations).innerJoin(restaurants, eq(restaurants.id, locations.restaurantId)).where(eq(locations.id, o.locationId));
    return { name: row.r.name, phone: row.l.phone ?? '', line1: row.l.line1, city: row.l.city, state: row.l.state, postalCode: row.l.postalCode, lat: row.l.lat, lng: row.l.lng, instructions: `Order ${o.code}` };
  }

  async dropoffStop(o: Order): Promise<Stop> {
    const d = o.dropoff as Stop;
    const [u] = await this.db.select().from(users).where(eq(users.id, o.customerId));
    return { ...d, name: u?.name ?? 'Customer', phone: u?.phone ?? d.phone ?? '' };
  }

  /** Builds the dropoff snapshot stored on the order from a saved address. */
  static dropoffFromAddress(a: typeof addresses.$inferSelect) {
    return { line1: a.line2 ? `${a.line1} ${a.line2}` : a.line1, city: a.city, state: a.state, postalCode: a.postalCode, lat: a.lat, lng: a.lng, instructions: a.dropoffInstructions ?? undefined, name: '', phone: '' };
  }
}
