/**
 * Refunds — brief §"Refund allocation". The customer refund is made on the restaurant's direct
 * charge; the delivery allocation is returned separately with an application-fee refund
 * (Stripe never returns application fees automatically for partial component refunds).
 */
import type Stripe from 'stripe';
import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { driverTransfers, fulfillments, orders, quotes, refunds, supplierObligations } from '../db/schema';
import { Allocation } from '../core/allocation';
import { AlreadyRefunded, emptyRefunded, planRefund, RefundRequest } from '../core/refunds';
import { LedgerService } from './ledger.service';

export class RefundsService {
  constructor(private readonly stripe: Stripe, private readonly db: Db, private readonly ledger: LedgerService) {}

  private async context(orderId: string) {
    const [o] = await this.db.select().from(orders).where(eq(orders.id, orderId));
    if (!o || !o.paymentIntentId) throw new Error('Order not paid');
    const [q] = await this.db.select().from(quotes).where(eq(quotes.id, o.quoteId));
    const allocation: Allocation = {
      F: q.foodCents, S: q.serviceChargeCents, X: q.taxCents, T: q.tipCents,
      D: q.deliveryCents, R: q.restaurantDeliveryCents, C: q.customerDeliveryCents,
      Q: q.totalCents, A: q.applicationFeeCents, restaurantRetained: q.totalCents - q.applicationFeeCents,
    };
    const prior = await this.db.select().from(refunds).where(and(eq(refunds.orderId, o.id), eq(refunds.status, 'succeeded')));
    const already = prior.reduce<AlreadyRefunded>((acc, r) => {
      const c = r.components as RefundRequest;
      acc.foodCents += c.foodCents; acc.serviceChargeCents += c.serviceChargeCents; acc.taxCents += c.taxCents;
      acc.customerDeliveryCents += c.customerDeliveryCents; acc.restoreSubsidyCents += c.restoreSubsidyCents; acc.tipCents += c.tipCents;
      return acc;
    }, emptyRefunded());
    const [f] = await this.db.select().from(fulfillments).where(eq(fulfillments.orderId, o.id));
    const [dt] = await this.db.select().from(driverTransfers).where(eq(driverTransfers.orderId, o.id));
    const [so] = await this.db.select().from(supplierObligations).where(eq(supplierObligations.orderId, o.id));
    const tipSettled = dt?.status === 'paid' || !!so?.tipSubmittedAt;
    const feeRefundedSoFar = prior.reduce((s, r) => s + r.applicationFeeRefundCents, 0);
    const feeRemaining = Math.max(0, (o.applicationFeeCents ?? allocation.A) - feeRefundedSoFar);
    return { o, allocation, already, deliveryFulfilled: f?.status === 'delivered', tipSettled, feeRemaining };
  }

  /** `requestId` is the caller's idempotency key (one per support action). */
  async refund(orderId: string, req: RefundRequest, requestId: string) {
    const ctx = await this.context(orderId);
    const planned = planRefund(req, ctx);
    // The captured application fee is D + T − the delivery's fee share, so the platform can return at
    // most what it actually took. Stripe keeps processing fees on refunds; the delivery's part of any
    // shortfall is owed back to the restaurant (credited on its next subscription invoice).
    const feeRefund = Math.min(planned.applicationFeeRefundCents, ctx.feeRemaining);
    const owedToRestaurant = planned.applicationFeeRefundCents - feeRefund;
    const plan = { ...planned, applicationFeeRefundCents: feeRefund, owedToRestaurantCents: owedToRestaurant };
    const idem = `refund:${orderId}:${requestId}`;
    const [row] = await this.db.insert(refunds).values({
      orderId, idempotencyKey: idem, components: req,
      chargeRefundCents: plan.chargeRefundCents, applicationFeeRefundCents: plan.applicationFeeRefundCents,
    }).onConflictDoNothing({ target: refunds.idempotencyKey }).returning();
    if (!row) return (await this.db.select().from(refunds).where(eq(refunds.idempotencyKey, idem)))[0];

    let stripeRefundId: string | null = null;
    let feeRefundId: string | null = null;
    try {
      if (plan.chargeRefundCents > 0) {
        const r = await this.stripe.refunds.create(
          { payment_intent: ctx.o.paymentIntentId!, amount: plan.chargeRefundCents, refund_application_fee: false, reason: 'requested_by_customer', metadata: { send_koro_order_id: orderId, send_koro_refund_id: row.id } },
          { stripeAccount: ctx.o.stripeAccountId, idempotencyKey: `${idem}:charge` },
        );
        stripeRefundId = r.id;
      }
      if (plan.applicationFeeRefundCents > 0) {
        if (!ctx.o.applicationFeeId) throw new Error('Application fee not recorded yet — retry after payment event processed');
        const fr = await this.stripe.applicationFees.createRefund(ctx.o.applicationFeeId, { amount: plan.applicationFeeRefundCents, metadata: { send_koro_order_id: orderId, send_koro_refund_id: row.id } }, { idempotencyKey: `${idem}:fee` });
        feeRefundId = fr.id;
      }
      await this.db.update(refunds).set({ status: 'succeeded', stripeRefundId, stripeFeeRefundId: feeRefundId }).where(eq(refunds.id, row.id));
    } catch (e) {
      await this.db.update(refunds).set({ status: 'failed', stripeRefundId, stripeFeeRefundId: feeRefundId }).where(eq(refunds.id, row.id));
      throw e;
    }

    await this.ledger.write(orderId, ctx.o.restaurantId, `refund:${row.id}`, [
      { account: 'refund_food', amountCents: -req.foodCents, state: 'paid', ref: stripeRefundId ?? undefined },
      { account: 'refund_service', amountCents: -req.serviceChargeCents, state: 'paid' },
      { account: 'refund_tax', amountCents: -req.taxCents, state: 'paid' },
      { account: 'refund_customer_delivery', amountCents: -req.customerDeliveryCents, state: 'paid' },
      { account: 'restaurant_subsidy_restored', amountCents: req.restoreSubsidyCents, state: 'paid', ref: feeRefundId ?? undefined },
      { account: 'delivery_allocation', amountCents: -(req.customerDeliveryCents + req.restoreSubsidyCents), state: 'paid', ref: feeRefundId ?? undefined },
      { account: 'driver_tip', amountCents: -req.tipCents, state: 'paid' },
      { account: 'fee_share_owed_to_restaurant', amountCents: owedToRestaurant, state: 'owed' },
    ]);
    const full = plan.chargeRefundCents + ctx.already.foodCents + ctx.already.serviceChargeCents + ctx.already.taxCents + ctx.already.customerDeliveryCents + ctx.already.tipCents >= ctx.allocation.Q;
    await this.db.update(orders).set({ status: full ? 'refunded' : 'partially_refunded' }).where(eq(orders.id, orderId));
    return { ...row, status: 'succeeded', stripeRefundId, stripeFeeRefundId: feeRefundId, plan };
  }
}
