/**
 * Per-order ledger — brief §"Required records and controls": distinguish pending, available,
 * owed and paid amounts; keep food, tax, delivery allocation, tips and Stripe fees separate.
 */
import type Stripe from 'stripe';
import { eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { ledgerEntries, orders, quotes } from '../db/schema';
import { deliveryFeeShare } from '../core/allocation';
import { allocationFromQuote } from './checkout.service';

type Entry = { account: string; amountCents: number; state: 'pending' | 'available' | 'owed' | 'paid'; ref?: string };

export class LedgerService {
  constructor(private readonly stripe: Stripe, private readonly db: Db) {}

  async write(orderId: string, restaurantId: string, eventKey: string, entries: Entry[], at = new Date()) {
    const rows = entries.filter((e) => e.amountCents !== 0).map((e) => ({
      orderId, restaurantId, account: e.account, amountCents: e.amountCents, state: e.state, ref: e.ref ?? null,
      dedupeKey: `${eventKey}:${e.account}`, effectiveAt: at,
    }));
    if (rows.length) await this.db.insert(ledgerEntries).values(rows).onConflictDoNothing({ target: ledgerEntries.dedupeKey });
  }

  /**
   * payment_intent.succeeded on the restaurant account (after capture). Idempotent: ledger rows are
   * keyed by PaymentIntent id, so a repeated or out-of-order event never double-books.
   */
  async recordPaid(pi: Stripe.PaymentIntent, connectedAccount: string): Promise<{ orderId: string; firstTime: boolean } | null> {
    const orderId = pi.metadata?.send_koro_order_id;
    if (!orderId) return null;
    const [o] = await this.db.select().from(orders).where(eq(orders.id, orderId));
    if (!o) return null;
    const [q] = await this.db.select().from(quotes).where(eq(quotes.id, o.quoteId));
    const firstTime = o.status !== 'paid';

    // Direct-charge objects live on the restaurant account: query them in that context.
    const chargeId = typeof pi.latest_charge === 'string' ? pi.latest_charge : pi.latest_charge?.id;
    let feeId: string | null = null;
    let stripeFee: number | null = null;
    if (chargeId) {
      const charge = await this.stripe.charges.retrieve(chargeId, { expand: ['balance_transaction'] }, { stripeAccount: connectedAccount });
      feeId = typeof charge.application_fee === 'string' ? charge.application_fee : charge.application_fee?.id ?? null;
      const bt = charge.balance_transaction as Stripe.BalanceTransaction | null;
      if (bt && typeof bt === 'object') {
        // Stripe processing fee (excludes our application fee) — paid by the restaurant.
        stripeFee = bt.fee_details.filter((f) => f.type === 'stripe_fee').reduce((s, f) => s + f.amount, 0);
      }
    }
    const paidAt = new Date((pi.created ?? Math.floor(Date.now() / 1000)) * 1000);
    await this.db.update(orders).set({ status: 'paid', chargeId: chargeId ?? null, applicationFeeId: feeId, stripeFeeCents: stripeFee, paidAt: o.paidAt ?? new Date() })
      .where(eq(orders.id, o.id));

    // Delivery money bears its own share of the processing fee (never the tip, never driver pay).
    const shareUsed = o.deliveryFeeShareCents ?? 0; // settled through the lower application fee at capture
    const shareActual = stripeFee !== null ? deliveryFeeShare(allocationFromQuote(q), stripeFee) : shareUsed;
    await this.write(o.id, o.restaurantId, `paid:${pi.id}`, [
      { account: 'restaurant_food', amountCents: q.foodCents, state: 'available', ref: chargeId ?? undefined },
      { account: 'restaurant_service', amountCents: q.serviceChargeCents, state: 'available' },
      { account: 'restaurant_tax', amountCents: q.taxCents, state: 'available' },
      { account: 'restaurant_delivery_contribution', amountCents: -q.restaurantDeliveryCents, state: 'available' },
      { account: 'customer_delivery', amountCents: q.customerDeliveryCents, state: 'available' },
      // Collected by Send Koro through the application fee. Not available until Stripe settles it.
      { account: 'delivery_allocation', amountCents: q.deliveryCents, state: 'pending', ref: feeId ?? undefined },
      // Owed in full to whoever fulfils the delivery — never platform revenue.
      { account: 'driver_tip', amountCents: q.tipCents, state: 'owed', ref: feeId ?? undefined },
      ...(stripeFee !== null ? [{ account: 'stripe_fee_restaurant', amountCents: -stripeFee, state: 'paid' as const, ref: chargeId ?? undefined }] : []),
      // Restaurant is credited the delivery's fee share via the reduced application fee …
      { account: 'restaurant_fee_share_credit', amountCents: shareUsed, state: 'paid' },
      // … which is a cost of the delivery allocation (platform), not of the restaurant.
      { account: 'delivery_processing_fee', amountCents: -shareUsed, state: 'paid' },
      // Estimate vs actual Stripe fee (e.g. card type) — tracked, absorbed by the delivery ledger.
      { account: 'delivery_fee_share_variance', amountCents: shareUsed - shareActual, state: 'paid' },
    ], paidAt);
    return { orderId: o.id, firstTime };
  }

  /** Net food sales for a restaurant in [start, end): food − food refunds (subscription tier base). */
  async foodSalesForPeriod(restaurantId: string, start: Date, end: Date) {
    const rows = await this.db.execute<{ account: string; total: string }>(sql`
      select account, coalesce(sum(amount_cents), 0)::text as total from ledger_entries
      where restaurant_id = ${restaurantId} and account in ('restaurant_food', 'refund_food')
        and effective_at >= ${start.toISOString()} and effective_at < ${end.toISOString()}
      group by account`);
    const food = Number(rows.rows.find((r) => r.account === 'restaurant_food')?.total ?? 0);
    const refunds = -Number(rows.rows.find((r) => r.account === 'refund_food')?.total ?? 0);
    return { foodSalesCents: food, foodRefundsCents: refunds, netBaseCents: food - refunds };
  }
}
