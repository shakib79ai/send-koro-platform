/**
 * Orders: checkout preview → place (card authorised on the restaurant's own Stripe account) →
 * restaurant accepts (card captured) or declines (hold released) → preparing → ready → courier.
 *
 * Money is computed in two places only: `core/cart.ts` (food, restaurant fees, restaurant tax) and
 * the payments service (delivery split, application fee). This service glues them and checks that
 * the receipt the customer sees equals what the card is charged.
 *
 * Worked example (cents): 2 × 1600 biryani = 3200 food, 10% service charge 320, tax 8.875% on 3520
 * = 312, delivery quote 780 with "restaurant pays 50%" → customer 390, restaurant 390, tip 400.
 * Receipt: 3200 + 320 + 312 + 780 − 390 + 400 = 4622 = the amount authorised.
 */
import { randomInt } from 'node:crypto';
import { and, desc, eq, gte, inArray, isNotNull, lt, lte, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { addresses, deliveries, drivers, locationHours, locations, orders, restaurantFees, restaurants } from '../db/schema';
import { priceCart, CartLineInput } from '../core/cart';
import { buildReceipt } from '../core/receipt';
import { CUSTOMER_STATUS_TEXT, OrderStatus } from '../core/order-status';
import { haversineMeters } from '../core/geo';
import { isOpenAt } from '../core/hours';
import { AppError, badRequest, conflict, forbidden, notFound } from '../common/http';
import { PaymentsClient, PaymentsError } from '../integrations/payments.client';
import type { MenuService } from '../menu/menu.service';
import type { RestaurantsService } from '../restaurants/restaurants.service';
import { DispatchService } from '../dispatch/dispatch.service';
import type { Order, OrderStateService } from './order-state.service';
import type { AuthUser } from '../auth/auth.guard';
import type { NotificationsService } from '../notifications/notifications.service';

export interface CheckoutInput {
  locationId: string;
  fulfilment: 'delivery' | 'pickup';
  addressId?: string;
  lines: CartLineInput[];
  tipCents: number;
  notes?: string;
}

const LIVE: OrderStatus[] = ['placed', 'accepted', 'preparing', 'ready', 'picked_up'];

export class OrdersService {
  constructor(
    private readonly db: Db,
    private readonly payments: PaymentsClient,
    private readonly menu: MenuService,
    private readonly restaurants: RestaurantsService,
    private readonly dispatch: DispatchService,
    private readonly state: OrderStateService,
    private readonly notify: NotificationsService,
    private readonly cfg: { autoDeclineMinutes: number },
    private readonly now: () => Date = () => new Date(),
  ) {}

  // ── Customer ──────────────────────────────────────────────────────────────
  async preview(customer: AuthUser, input: CheckoutInput) {
    const [row] = await this.db.select({ l: locations, r: restaurants }).from(locations).innerJoin(restaurants, eq(restaurants.id, locations.restaurantId)).where(eq(locations.id, input.locationId));
    if (!row || row.r.status !== 'live') throw notFound('Restaurant');
    const { l, r } = row;
    const hours = await this.db.select().from(locationHours).where(eq(locationHours.locationId, l.id));
    if (!l.acceptingOrders || !isOpenAt(hours, l.timezone, this.now())) throw conflict('restaurant_closed', `${r.name} isn’t taking orders right now`);

    let dropoff: ReturnType<typeof DispatchService.dropoffFromAddress> | null = null;
    if (input.fulfilment === 'delivery') {
      if (!l.deliveryEnabled) throw badRequest('delivery_unavailable', `${r.name} offers pickup only`);
      if (!input.addressId) throw badRequest('address_required', 'Choose a delivery address');
      const [a] = await this.db.select().from(addresses).where(and(eq(addresses.id, input.addressId), eq(addresses.userId, customer.id)));
      if (!a || a.deletedAt) throw notFound('Address');
      if (haversineMeters(l, a) > l.deliveryRadiusMeters) throw badRequest('out_of_range', `${r.name} doesn’t deliver to this address`);
      dropoff = DispatchService.dropoffFromAddress(a);
    } else if (!l.pickupEnabled) throw badRequest('pickup_unavailable', `${r.name} offers delivery only`);

    const menu = await this.menu.forPricing(r.id, [...new Set(input.lines.map((x) => x.itemId))]);
    const fees = await this.db.select().from(restaurantFees).where(and(eq(restaurantFees.restaurantId, r.id), eq(restaurantFees.active, true)));
    const cart = priceCart({ lines: input.lines, menu, fees, taxRatePpm: l.taxRatePpm, now: this.now() });

    let deliveryQuote = null;
    if (dropoff) {
      const pickupStop = { name: r.name, phone: l.phone ?? '', line1: l.line1, city: l.city, state: l.state, postalCode: l.postalCode, lat: l.lat, lng: l.lng };
      try { deliveryQuote = await this.dispatch.quotePrice(pickupStop, { ...dropoff, name: 'Customer', phone: customer.phone }, cart.foodCents); }
      catch { throw conflict('delivery_unavailable', 'Delivery isn’t available right now. Try pickup or try again soon.'); }
    }
    const tip = input.fulfilment === 'delivery' ? input.tipCents : 0;
    const quote = await this.paymentsCall(() => this.payments.quote({
      restaurantId: r.id, foodCents: cart.foodCents, serviceChargeCents: cart.serviceChargeCents, taxCents: cart.taxCents, tipCents: tip,
      taxBreakdown: cart.taxCents ? [{ label: 'Sales tax', rateBps: Math.round(cart.taxRatePpm / 100), amountCents: cart.taxCents }] : [],
      delivery: deliveryQuote
        ? { provider: deliveryQuote.provider, providerQuoteId: deliveryQuote.quoteId, deliveryCents: deliveryQuote.feeCents, expiresAt: deliveryQuote.expiresAt.toISOString() }
        : { provider: 'pickup' },
    }));
    const receipt = buildReceipt(cart, quote.allocation, r.name);
    const etaMinutes = l.prepMinutes + (deliveryQuote ? Math.ceil(deliveryQuote.etaSeconds / 60) : 0);
    return { restaurant: { id: r.id, name: r.name }, location: l, cart, dropoff, deliveryQuote, quote, receipt, etaMinutes, tipCents: tip };
  }

  async place(customer: AuthUser, input: CheckoutInput & { idempotencyKey: string; expectedTotalCents: number }) {
    const [existing] = await this.db.select().from(orders).where(and(eq(orders.customerId, customer.id), eq(orders.idempotencyKey, input.idempotencyKey)));
    if (existing) return this.resumePayment(existing);

    const p = await this.preview(customer, input);
    if (p.receipt.totalCents !== input.expectedTotalCents) {
      throw new AppError(409, 'price_changed', `The total changed to $${(p.receipt.totalCents / 100).toFixed(2)}. Please review and place the order again.`);
    }
    const a = p.quote.allocation;
    const values = {
      code: '', customerId: customer.id, restaurantId: p.restaurant.id, locationId: p.location.id, fulfilment: input.fulfilment,
      items: p.cart.lines, dropoff: p.dropoff, notes: input.notes,
      foodCents: a.F, serviceChargeCents: a.S, taxCents: a.X, tipCents: a.T, deliveryCents: a.D, customerDeliveryCents: a.C, restaurantDeliveryCents: a.R, totalCents: a.Q,
      receipt: { ...p.receipt, fees: p.cart.fees }, paymentsQuoteId: p.quote.quoteId, deliveryQuote: p.deliveryQuote, idempotencyKey: input.idempotencyKey,
    };
    let order: Order | undefined;
    for (let attempt = 0; attempt < 5 && !order; attempt++) {
      values.code = `SK-${randomInt(1000, 1_000_000)}`;
      try {
        [order] = await this.db.insert(orders).values(values).returning();
      } catch (e) {
        const msg = (e as Error).message + String((e as { cause?: unknown }).cause ?? '');
        if (msg.includes('orders_customer_idempotency')) {
          const [again] = await this.db.select().from(orders).where(and(eq(orders.customerId, customer.id), eq(orders.idempotencyKey, input.idempotencyKey)));
          return this.resumePayment(again);
        }
        if (!msg.includes('orders_code')) throw e;
      }
    }
    if (!order) throw new Error('Could not allocate an order code');
    await this.state.log(order.id, 'order.created', `customer:${customer.id}`);
    return this.resumePayment(order);
  }

  /** Same PaymentIntent every time (payments service is idempotent per quote). */
  private async resumePayment(o: Order) {
    if (o.status !== 'pending_payment') return { order: this.customerView(o), payment: null };
    const pay = await this.paymentsCall(() => this.payments.createPayment(o.paymentsQuoteId!));
    if (!o.paymentsOrderId) {
      [o] = await this.db.update(orders).set({ paymentsOrderId: pay.orderId }).where(eq(orders.id, o.id)).returning();
    }
    return { order: this.customerView(o), payment: { clientSecret: pay.clientSecret, stripeAccount: pay.stripeAccount, paymentIntentId: pay.paymentIntentId, totalCents: pay.totalCents } };
  }

  /** The app calls this after Stripe confirms the card; the sweep job covers apps that closed. */
  async confirmPayment(customer: AuthUser, orderId: string) {
    const o = await this.ownOrder(customer, orderId);
    return this.customerView(await this.checkPayment(o));
  }

  private async checkPayment(o: Order) {
    if (o.status !== 'pending_payment' || !o.paymentsOrderId) return o;
    const st = await this.payments.paymentStatus(o.paymentsOrderId);
    if (!st.authorized) return o;
    return this.state.transition(o.id, 'placed', 'payments');
  }

  async cancelByCustomer(customer: AuthUser, orderId: string) {
    const o = await this.ownOrder(customer, orderId);
    if (o.status === 'pending_payment') return this.customerView(await this.state.transition(o.id, 'cancelled', `customer:${customer.id}`, { cancelReason: 'customer_cancelled' }));
    if (o.status !== 'placed') throw conflict('too_late', 'The restaurant has already started your order. Contact support to cancel.');
    await this.payments.decline(o.paymentsOrderId!, 'customer_cancelled');
    return this.customerView(await this.state.transition(o.id, 'cancelled', `customer:${customer.id}`, { cancelReason: 'customer_cancelled' }));
  }

  async customerOrders(customer: AuthUser) {
    const rows = await this.db.select({ o: orders, name: restaurants.name }).from(orders).innerJoin(restaurants, eq(restaurants.id, orders.restaurantId))
      .where(and(eq(orders.customerId, customer.id), inArray(orders.status, ['placed', 'accepted', 'preparing', 'ready', 'picked_up', 'delivered', 'completed', 'declined', 'cancelled']))).orderBy(desc(orders.createdAt)).limit(100);
    return rows.map(({ o, name }) => ({ ...this.customerView(o), restaurantName: name }));
  }

  async customerOrder(customer: AuthUser, orderId: string) {
    const o = await this.ownOrder(customer, orderId);
    const [d] = await this.db.select().from(deliveries).where(eq(deliveries.orderId, o.id));
    let courier: { firstName: string; lat: number | null; lng: number | null } | null = null;
    if (d?.driverId && d.provider === 'own_driver' && ['assigned', 'at_pickup', 'picked_up', 'at_dropoff'].includes(d.status)) {
      const [drv] = await this.db.select().from(drivers).where(eq(drivers.id, d.driverId));
      if (drv) courier = { firstName: drv.name.split(' ')[0], lat: drv.lat, lng: drv.lng };
    }
    const [r] = await this.db.select({ name: restaurants.name }).from(restaurants).where(eq(restaurants.id, o.restaurantId));
    // Third-party tracking links carry the courier company's branding, so they are not shown (rule 4).
    return { ...this.customerView(o), restaurantName: r?.name ?? '', delivery: d ? { status: d.status, courier } : null };
  }

  private async ownOrder(customer: AuthUser, orderId: string) {
    const o = await this.state.load(orderId);
    if (o.customerId !== customer.id) throw notFound('Order');
    return o;
  }

  customerView(o: Order) {
    return {
      id: o.id, code: o.code, status: o.status, statusText: CUSTOMER_STATUS_TEXT[o.status], fulfilment: o.fulfilment,
      restaurantId: o.restaurantId, locationId: o.locationId, items: o.items, dropoff: o.dropoff, notes: o.notes,
      receipt: o.receipt, totalCents: o.totalCents, createdAt: o.createdAt, placedAt: o.placedAt, acceptedAt: o.acceptedAt, deliveredAt: o.deliveredAt,
    };
  }

  // ── Restaurant ────────────────────────────────────────────────────────────
  async liveOrders(user: AuthUser, restaurantId: string, locationId?: string) {
    await this.restaurants.requireMember(user, restaurantId);
    const where = [eq(orders.restaurantId, restaurantId), inArray(orders.status, LIVE)];
    if (locationId) where.push(eq(orders.locationId, locationId));
    const rows = await this.db.select().from(orders).where(and(...where)).orderBy(orders.placedAt);
    return this.restaurantViews(rows);
  }

  async history(user: AuthUser, restaurantId: string, q: { from?: Date; to?: Date; limit?: number }) {
    await this.restaurants.requireMember(user, restaurantId);
    const where = [eq(orders.restaurantId, restaurantId), isNotNull(orders.placedAt)];
    if (q.from) where.push(gte(orders.placedAt, q.from));
    if (q.to) where.push(lte(orders.placedAt, q.to));
    const rows = await this.db.select().from(orders).where(and(...where)).orderBy(desc(orders.placedAt)).limit(q.limit ?? 100);
    return this.restaurantViews(rows);
  }

  /**
   * Sales summary for the restaurant portal (earnings, plan). Counts orders the restaurant accepted.
   * Tips are excluded (they go to couriers). Refunds and card processing live in Stripe/payments.
   */
  async summary(user: AuthUser, restaurantId: string, q: { from: Date; to: Date }) {
    await this.restaurants.requireMember(user, restaurantId);
    const accepted = sql`${orders.status} in ('accepted','preparing','ready','picked_up','delivered','completed')`;
    const [t] = await this.db.select({
      orders: sql<number>`count(*) filter (where ${accepted})::int`,
      declined: sql<number>`count(*) filter (where ${orders.status} = 'declined')::int`,
      inProgress: sql<number>`count(*) filter (where ${orders.status} in ('placed','accepted','preparing','ready','picked_up'))::int`,
      foodCents: sql<number>`coalesce(sum(${orders.foodCents}) filter (where ${accepted}), 0)::bigint`,
      serviceChargeCents: sql<number>`coalesce(sum(${orders.serviceChargeCents}) filter (where ${accepted}), 0)::bigint`,
      taxCents: sql<number>`coalesce(sum(${orders.taxCents}) filter (where ${accepted}), 0)::bigint`,
      deliveryPaidCents: sql<number>`coalesce(sum(${orders.restaurantDeliveryCents}) filter (where ${accepted}), 0)::bigint`,
      avgAcceptSeconds: sql<number>`coalesce(avg(extract(epoch from (${orders.acceptedAt} - ${orders.placedAt}))) filter (where ${orders.acceptedAt} is not null), 0)::int`,
    }).from(orders).where(and(eq(orders.restaurantId, restaurantId), gte(orders.placedAt, q.from), lt(orders.placedAt, q.to)));
    const daily = await this.db.select({
      day: sql<string>`to_char(${orders.placedAt} at time zone 'America/New_York', 'YYYY-MM-DD')`,
      foodCents: sql<number>`coalesce(sum(${orders.foodCents}), 0)::bigint`,
      orders: sql<number>`count(*)::int`,
    }).from(orders).where(and(eq(orders.restaurantId, restaurantId), gte(orders.placedAt, q.from), lt(orders.placedAt, q.to), accepted))
      .groupBy(sql`1`).orderBy(sql`1`);
    const num = (v: unknown) => Number(v ?? 0);
    return {
      from: q.from, to: q.to,
      orders: t.orders, declined: t.declined, inProgress: t.inProgress, avgAcceptSeconds: t.avgAcceptSeconds,
      foodCents: num(t.foodCents), serviceChargeCents: num(t.serviceChargeCents), taxCents: num(t.taxCents), deliveryPaidCents: num(t.deliveryPaidCents),
      commissionCents: 0,
      daily: daily.map((d) => ({ day: d.day, foodCents: num(d.foodCents), orders: d.orders })),
    };
  }

  private async restaurantViews(rows: Order[]) {
    const ds = rows.length ? await this.db.select().from(deliveries).where(inArray(deliveries.orderId, rows.map((o) => o.id))) : [];
    const autoDeclineMs = this.cfg.autoDeclineMinutes * 60_000;
    return rows.map((o) => {
      const d = ds.find((x) => x.orderId === o.id);
      return {
        id: o.id, code: o.code, status: o.status, fulfilment: o.fulfilment, locationId: o.locationId, items: o.items, notes: o.notes,
        foodCents: o.foodCents, serviceChargeCents: o.serviceChargeCents, taxCents: o.taxCents, tipCents: o.tipCents,
        restaurantDeliveryCents: o.restaurantDeliveryCents, totalCents: o.totalCents,
        placedAt: o.placedAt, acceptedAt: o.acceptedAt, readyAt: o.readyAt,
        acceptBy: o.status === 'placed' && o.placedAt ? new Date(o.placedAt.getTime() + autoDeclineMs) : null,
        // Courier status without the company name.
        courier: d ? { status: d.status } : null,
      };
    });
  }

  private async staffOrder(user: AuthUser, orderId: string) {
    const o = await this.state.load(orderId);
    await this.restaurants.requireMember(user, o.restaurantId);
    return o;
  }

  async accept(user: AuthUser, orderId: string, prepMinutes?: number) {
    const o = await this.staffOrder(user, orderId);
    if (o.status === 'accepted') return o;
    if (o.status !== 'placed') throw conflict('invalid_transition', `Order is ${o.status}`);
    // Capture first: an accepted order is always a paid order.
    await this.paymentsCall(() => this.payments.accept(o.paymentsOrderId!));
    const accepted = await this.state.transition(o.id, 'accepted', `staff:${user.id}`, {}, { prepMinutes });
    if (accepted.fulfilment === 'delivery') {
      await this.dispatch.start(accepted).catch(async (e) => {
        await this.state.log(o.id, 'dispatch.error', 'system', { message: (e as Error).message });
        this.notify.live('admin', 'delivery.failed', { orderId: o.id, message: (e as Error).message });
      });
    }
    return accepted;
  }

  async decline(user: AuthUser, orderId: string, reason: string) {
    const o = await this.staffOrder(user, orderId);
    if (o.status !== 'placed') throw conflict('invalid_transition', `Order is ${o.status}`);
    await this.paymentsCall(() => this.payments.decline(o.paymentsOrderId!, 'restaurant_declined'));
    return this.state.transition(o.id, 'declined', `staff:${user.id}`, { cancelReason: reason });
  }

  async markPreparing(user: AuthUser, orderId: string) {
    const o = await this.staffOrder(user, orderId);
    return this.state.transition(o.id, 'preparing', `staff:${user.id}`);
  }

  async markReady(user: AuthUser, orderId: string) {
    const o = await this.staffOrder(user, orderId);
    const row = await this.state.transition(o.id, 'ready', `staff:${user.id}`);
    const [d] = await this.db.select().from(deliveries).where(eq(deliveries.orderId, o.id));
    if (d?.driverId) this.notify.live(`driver:${d.driverId}`, 'order.ready', { orderId: o.id, code: o.code });
    return row;
  }

  /** Pickup orders: the customer collected it. */
  async markCollected(user: AuthUser, orderId: string) {
    const o = await this.staffOrder(user, orderId);
    if (o.fulfilment !== 'pickup') throw badRequest('not_pickup', 'Delivery orders are completed by the courier');
    if (o.status !== 'ready') await this.state.transition(o.id, 'ready', `staff:${user.id}`);
    return this.state.transition(o.id, 'completed', `staff:${user.id}`);
  }

  // ── Jobs ──────────────────────────────────────────────────────────────────
  /** Every minute: finish payments the app didn't confirm; drop abandoned checkouts after 30 min. */
  async sweepPendingPayments() {
    const cutoff = new Date(this.now().getTime() - 30 * 60_000);
    const rows = await this.db.select().from(orders).where(eq(orders.status, 'pending_payment')).limit(200);
    let placed = 0, abandoned = 0;
    for (const o of rows) {
      const after = await this.checkPayment(o).catch(() => o);
      if (after.status === 'placed') placed++;
      else if (o.createdAt < cutoff) { await this.state.transition(o.id, 'cancelled', 'system', { cancelReason: 'payment_not_completed' }); abandoned++; }
    }
    return { placed, abandoned };
  }

  /** Unanswered orders are declined and the card hold released after AUTO_DECLINE_MINUTES. */
  async autoDecline() {
    const cutoff = new Date(this.now().getTime() - this.cfg.autoDeclineMinutes * 60_000);
    const rows = await this.db.select().from(orders).where(and(eq(orders.status, 'placed'), lt(orders.placedAt, cutoff)));
    for (const o of rows) {
      await this.payments.decline(o.paymentsOrderId!, 'auto_declined');
      await this.state.transition(o.id, 'declined', 'system', { cancelReason: 'auto_declined' });
    }
    return { declined: rows.length };
  }

  private async paymentsCall<T>(fn: () => Promise<T>): Promise<T> {
    try { return await fn(); } catch (e) {
      if (e instanceof PaymentsError && e.status >= 400 && e.status < 500) {
        const code = e.code ?? 'payment_error';
        const friendly: Record<string, string> = {
          rule_not_authorized: 'This restaurant isn’t ready to take orders yet.',
          insufficient_restaurant_proceeds: 'This order can’t be placed with the current delivery settings.',
          quote_expired: 'The delivery price expired. Please try again.',
        };
        throw new AppError(409, code, friendly[code] ?? 'Payment could not be set up.');
      }
      throw e;
    }
  }

  /** Guard used by controllers that accept an order ID from staff. */
  static assertStaff(user: AuthUser) { if (user.role !== 'restaurant_staff' && user.role !== 'admin') throw forbidden(); }
}
