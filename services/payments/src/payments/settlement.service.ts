/**
 * Delivery settlement — brief §"Own-network driver settlement", §"Third-party fulfillment",
 * §"Driver tips and fulfillment settlement".
 *
 * Own drivers: one idempotent platform → driver transfer per order = locked offer pay + 100% of tip.
 *   Never pays twice (unique order_id + Stripe idempotency key). If the platform balance isn't
 *   available yet the transfer stays "owed" and the retry job pays it later. Disputed orders are held.
 * Third-party: record the obligation (quoted vs actual, tip submitted through the provider's tip
 *   field) and reconcile against the provider's invoice. No Connect transfer to the provider.
 */
import type Stripe from 'stripe';
import { and, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/client';
import { drivers, driverTopUps, driverTransfers, fulfillments, orders, quotes, supplierObligations } from '../db/schema';
import { LedgerService } from './ledger.service';

/** What the courier company is owed: its own quote P, not the marked-up delivery price D. Older quotes have no P. */
const courierPrice = (q: { courierCents: number; deliveryCents: number }) => (q.courierCents > 0 ? q.courierCents : q.deliveryCents);

export class SettlementService {
  constructor(private readonly stripe: Stripe, private readonly db: Db, private readonly ledger: LedgerService) {}

  /** Called by dispatch when an own-network driver completes the delivery. */
  async ownDriverDelivered(orderId: string, driverId: string, driverPayCents: number) {
    const [o] = await this.db.select().from(orders).where(eq(orders.id, orderId));
    if (!o) throw new Error('Order not found');
    const [q] = await this.db.select().from(quotes).where(eq(quotes.id, o.quoteId));
    await this.db.insert(fulfillments).values({ orderId, provider: 'own_driver', driverId, driverPayCents, tipCents: q.tipCents, status: 'delivered', completedAt: new Date() })
      .onConflictDoUpdate({ target: fulfillments.orderId, set: { status: 'delivered', completedAt: new Date(), driverId, driverPayCents } });
    const [t] = await this.db.insert(driverTransfers).values({
      orderId, driverId, payCents: driverPayCents, tipCents: q.tipCents, amountCents: driverPayCents + q.tipCents,
      idempotencyKey: `driver-transfer:${orderId}`, status: o.status === 'disputed' ? 'on_hold' : 'pending',
    }).onConflictDoNothing({ target: driverTransfers.orderId }).returning();
    // Margin = D − driver pay − the delivery's processing-fee share. The driver's locked pay and tip are
    // never reduced by fees (NYC delivery-worker rules); the fee comes out of Send Koro's delivery money.
    await this.ledger.write(orderId, o.restaurantId, `fulfilled:${orderId}`, [
      { account: 'driver_pay_owed', amountCents: -driverPayCents, state: 'owed' },
      { account: 'fulfillment_margin', amountCents: q.deliveryCents - driverPayCents - (o.deliveryFeeShareCents ?? 0), state: 'pending' },
    ]);
    const row = t ?? (await this.db.select().from(driverTransfers).where(eq(driverTransfers.orderId, orderId)))[0];
    return row.status === 'pending' ? this.payDriverTransfer(row.id) : row;
  }

  async payDriverTransfer(transferRowId: string) {
    const [t] = await this.db.select().from(driverTransfers).where(eq(driverTransfers.id, transferRowId));
    if (!t || t.status === 'paid' || t.status === 'on_hold') return t;
    const [d] = await this.db.select().from(drivers).where(eq(drivers.id, t.driverId));
    if (!d?.stripeAccountId || !d.transfersActive) {
      await this.db.update(driverTransfers).set({ status: 'owed', lastError: 'driver payouts not active' }).where(eq(driverTransfers.id, t.id));
      return { ...t, status: 'owed' as const };
    }
    // Receiving an application fee does not make it immediately available — check first.
    const bal = await this.stripe.balance.retrieve();
    const available = bal.available.filter((b) => b.currency === 'usd').reduce((s, b) => s + b.amount, 0);
    if (available < t.amountCents) {
      await this.db.update(driverTransfers).set({ status: 'owed', lastError: `platform available balance ${available}¢ < ${t.amountCents}¢` }).where(eq(driverTransfers.id, t.id));
      return { ...t, status: 'owed' as const };
    }
    await this.db.update(driverTransfers).set({ status: 'processing' }).where(eq(driverTransfers.id, t.id));
    try {
      const tr = await this.stripe.transfers.create(
        {
          amount: t.amountCents, currency: 'usd', destination: d.stripeAccountId, transfer_group: `order_${t.orderId}`,
          description: `Delivery pay + 100% tip · order ${t.orderId}`,
          metadata: { send_koro_order_id: t.orderId, pay_cents: String(t.payCents), tip_cents: String(t.tipCents) },
        },
        { idempotencyKey: t.idempotencyKey },
      );
      await this.db.update(driverTransfers).set({ status: 'paid', stripeTransferId: tr.id, lastError: null }).where(eq(driverTransfers.id, t.id));
      const [o] = await this.db.select().from(orders).where(eq(orders.id, t.orderId));
      await this.ledger.write(t.orderId, o.restaurantId, `driver-paid:${tr.id}`, [
        { account: 'driver_pay_owed', amountCents: t.payCents, state: 'paid', ref: tr.id },
        { account: 'driver_tip_paid', amountCents: t.tipCents, state: 'paid', ref: tr.id },
      ]);
      return { ...t, status: 'paid' as const, stripeTransferId: tr.id };
    } catch (e) {
      await this.db.update(driverTransfers).set({ status: 'failed', lastError: (e as Error).message }).where(eq(driverTransfers.id, t.id));
      throw e;
    }
  }

  /** Retry job: pay transfers that were owed (balance not yet available, driver onboarding finished). */
  async retryOwed() {
    const owed = await this.db.select().from(driverTransfers).where(inArray(driverTransfers.status, ['owed', 'failed']));
    const results = [];
    for (const t of owed) results.push(await this.payDriverTransfer(t.id).catch((e) => ({ id: t.id, error: (e as Error).message })));
    const owedTopUps = await this.db.select().from(driverTopUps).where(inArray(driverTopUps.status, ['owed', 'failed']));
    for (const t of owedTopUps) results.push(await this.payTopUp(t.id).catch((e) => ({ id: t.id, error: (e as Error).message })));
    return results;
  }

  /**
   * NYC minimum pay: $22.13 per hour of trip time (standard method). Tips never count toward it.
   *   Week: 5 h 00 m of trips (18 000 s), $98.00 locked pay → minimum ceil(18000 × 2213 / 3600) = 11065
   *   → top-up 11065 − 9800 = 1265, transferred once (unique driver+week, Stripe idempotency key).
   * The core API reports trip seconds and locked pay for the week; nothing is ever deducted.
   */
  async weeklyTopUp(driverId: string, weekStart: string, tripSeconds: number, paidCents: number, centsPerHour = 2213) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) throw new Error('weekStart must be YYYY-MM-DD');
    const minimumCents = Math.ceil((tripSeconds * centsPerHour) / 3600);
    const amountCents = Math.max(0, minimumCents - paidCents);
    const [row] = await this.db.insert(driverTopUps).values({
      driverId, weekStart, tripSeconds, minimumCents, paidCents, amountCents,
      idempotencyKey: `driver-topup:${driverId}:${weekStart}`, status: amountCents === 0 ? 'paid' : 'pending',
    }).onConflictDoNothing({ target: [driverTopUps.driverId, driverTopUps.weekStart] }).returning();
    const t = row ?? (await this.db.select().from(driverTopUps).where(and(eq(driverTopUps.driverId, driverId), eq(driverTopUps.weekStart, weekStart))))[0];
    return t.status === 'paid' || t.status === 'on_hold' ? t : this.payTopUp(t.id);
  }

  async payTopUp(topUpId: string) {
    const [t] = await this.db.select().from(driverTopUps).where(eq(driverTopUps.id, topUpId));
    if (!t || t.status === 'paid' || t.amountCents === 0) return t;
    const [d] = await this.db.select().from(drivers).where(eq(drivers.id, t.driverId));
    const owe = async (lastError: string) => {
      await this.db.update(driverTopUps).set({ status: 'owed', lastError }).where(eq(driverTopUps.id, t.id));
      return { ...t, status: 'owed' as const, lastError };
    };
    if (!d?.stripeAccountId || !d.transfersActive) return owe('driver payouts not active');
    const bal = await this.stripe.balance.retrieve();
    const available = bal.available.filter((b) => b.currency === 'usd').reduce((s, b) => s + b.amount, 0);
    if (available < t.amountCents) return owe(`platform available balance ${available}¢ < ${t.amountCents}¢`);
    try {
      const tr = await this.stripe.transfers.create(
        { amount: t.amountCents, currency: 'usd', destination: d.stripeAccountId, transfer_group: `topup_${t.driverId}_${t.weekStart}`,
          description: `NYC minimum pay top-up · week of ${t.weekStart}`,
          metadata: { send_koro_driver_id: t.driverId, week_start: t.weekStart, minimum_cents: String(t.minimumCents), paid_cents: String(t.paidCents) } },
        { idempotencyKey: t.idempotencyKey },
      );
      await this.db.update(driverTopUps).set({ status: 'paid', stripeTransferId: tr.id, lastError: null }).where(eq(driverTopUps.id, t.id));
      return { ...t, status: 'paid' as const, stripeTransferId: tr.id };
    } catch (e) {
      await this.db.update(driverTopUps).set({ status: 'failed', lastError: (e as Error).message }).where(eq(driverTopUps.id, t.id));
      throw e;
    }
  }

  /** Disputes: delivery funds are not guaranteed while a dispute is open (brief §"Disputes and tax"). */
  async holdForDispute(orderId: string) {
    await this.db.update(driverTransfers).set({ status: 'on_hold' }).where(and(eq(driverTransfers.orderId, orderId), inArray(driverTransfers.status, ['pending', 'owed', 'failed'])));
  }

  /** Third-party courier assigned — record what we owe the supplier and the tip passed via its tip field. */
  async supplierAssigned(orderId: string, provider: 'uber_direct' | 'doordash_drive', providerDeliveryId: string) {
    const [o] = await this.db.select().from(orders).where(eq(orders.id, orderId));
    const [q] = await this.db.select().from(quotes).where(eq(quotes.id, o.quoteId));
    await this.db.insert(fulfillments).values({ orderId, provider, providerDeliveryId, tipCents: q.tipCents, status: 'assigned' }).onConflictDoNothing({ target: fulfillments.orderId });
    await this.db.insert(supplierObligations).values({ orderId, provider, providerDeliveryId, quotedCents: courierPrice(q), tipCents: q.tipCents }).onConflictDoNothing({ target: supplierObligations.orderId });
    // The provider is paid its full quote and the full tip. The margin is the markup in D minus the delivery money's
    // processing-fee share: about 0 with the delivery markup on, −share for older quotes priced at P.
    await this.ledger.write(orderId, o.restaurantId, `supplier:${orderId}`, [
      { account: 'supplier_cost_owed', amountCents: -courierPrice(q), state: 'owed' },
      { account: 'fulfillment_margin', amountCents: q.deliveryCents - courierPrice(q) - (o.deliveryFeeShareCents ?? 0), state: 'pending' },
    ]);
    // Caller submits q.tipCents (in cents, 100%) in the provider's dedicated tip field, then calls markTipSubmitted.
    return { tipCentsToSubmit: q.tipCents, quotedCents: courierPrice(q) };
  }

  async markTipSubmitted(orderId: string) {
    await this.db.update(supplierObligations).set({ tipSubmittedAt: new Date() }).where(eq(supplierObligations.orderId, orderId));
  }

  /** Reconcile a provider invoice line; returns the variance to review (quoted vs billed). */
  async reconcileSupplierLine(orderId: string, line: { billedCents: number; tipCents: number; invoiceRef: string }) {
    const [s] = await this.db.select().from(supplierObligations).where(eq(supplierObligations.orderId, orderId));
    if (!s) throw new Error('No supplier obligation for order');
    const deliveryVariance = line.billedCents - s.quotedCents;
    const tipVariance = line.tipCents - s.tipCents;
    const status = deliveryVariance === 0 && tipVariance === 0 ? 'paid' : 'owed';
    await this.db.update(supplierObligations).set({ actualCents: line.billedCents, invoiceRef: line.invoiceRef, status }).where(eq(supplierObligations.orderId, orderId));
    return { deliveryVariance, tipVariance, matched: status === 'paid' };
  }
}
