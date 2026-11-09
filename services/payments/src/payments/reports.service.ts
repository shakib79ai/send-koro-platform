/**
 * Read-only money reports for the admin console (restaurant payouts, driver & courier settlements,
 * billing). Nothing here moves money. Amounts are integer cents.
 */
import type Stripe from 'stripe';
import { and, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { drivers, driverTopUps, driverTransfers, ledgerEntries, orders, quotes, refunds, restaurants, subscriptions, supplierObligations, tierSnapshots } from '../db/schema';

const num = (v: unknown) => Number(v ?? 0);

export class ReportsService {
  constructor(private readonly stripe: Stripe, private readonly db: Db) {}

  /** Whole platform for a period: charge volume on restaurant accounts, Send Koro's delivery allocation, refunds, settlements. */
  async overview(from: Date, to: Date) {
    const [o] = await this.db.select({
      paidOrders: sql<number>`count(*) filter (where ${orders.paidAt} is not null)::int`,
      volumeCents: sql<number>`coalesce(sum(${quotes.totalCents}) filter (where ${orders.paidAt} is not null), 0)::bigint`,
      foodCents: sql<number>`coalesce(sum(${quotes.foodCents}) filter (where ${orders.paidAt} is not null), 0)::bigint`,
      taxCents: sql<number>`coalesce(sum(${quotes.taxCents}) filter (where ${orders.paidAt} is not null), 0)::bigint`,
      tipCents: sql<number>`coalesce(sum(${quotes.tipCents}) filter (where ${orders.paidAt} is not null), 0)::bigint`,
      applicationFeeCents: sql<number>`coalesce(sum(${orders.applicationFeeCents}) filter (where ${orders.paidAt} is not null), 0)::bigint`,
      deliveryFeeShareCents: sql<number>`coalesce(sum(${orders.deliveryFeeShareCents}) filter (where ${orders.paidAt} is not null), 0)::bigint`,
    }).from(orders).innerJoin(quotes, eq(quotes.id, orders.quoteId)).where(and(gte(orders.createdAt, from), lt(orders.createdAt, to)));
    const [r] = await this.db.select({ n: sql<number>`count(*)::int`, chargeCents: sql<number>`coalesce(sum(${refunds.chargeRefundCents}), 0)::bigint`, feeCents: sql<number>`coalesce(sum(${refunds.applicationFeeRefundCents}), 0)::bigint` })
      .from(refunds).where(and(gte(refunds.createdAt, from), lt(refunds.createdAt, to)));
    const transfers = await this.db.select({ status: driverTransfers.status, n: sql<number>`count(*)::int`, cents: sql<number>`coalesce(sum(${driverTransfers.amountCents}), 0)::bigint` })
      .from(driverTransfers).where(and(gte(driverTransfers.createdAt, from), lt(driverTransfers.createdAt, to))).groupBy(driverTransfers.status);
    const suppliers = await this.db.select({ provider: supplierObligations.provider, status: supplierObligations.status, n: sql<number>`count(*)::int`, quotedCents: sql<number>`coalesce(sum(${supplierObligations.quotedCents}), 0)::bigint`, tipCents: sql<number>`coalesce(sum(${supplierObligations.tipCents}), 0)::bigint` })
      .from(supplierObligations).innerJoin(orders, eq(orders.id, supplierObligations.orderId)).where(and(gte(orders.createdAt, from), lt(orders.createdAt, to))).groupBy(supplierObligations.provider, supplierObligations.status);
    return {
      from, to,
      paidOrders: o.paidOrders, volumeCents: num(o.volumeCents), foodCents: num(o.foodCents), taxCents: num(o.taxCents), tipCents: num(o.tipCents),
      applicationFeeCents: num(o.applicationFeeCents), deliveryFeeShareCents: num(o.deliveryFeeShareCents), commissionCents: 0,
      refunds: { count: r.n, chargeCents: num(r.chargeCents), applicationFeeCents: num(r.feeCents) },
      driverTransfers: transfers.map((t) => ({ status: t.status, count: t.n, cents: num(t.cents) })),
      supplierObligations: suppliers.map((s) => ({ provider: s.provider, status: s.status, count: s.n, quotedCents: num(s.quotedCents), tipCents: num(s.tipCents) })),
    };
  }

  /** One restaurant: sales, refunds and transactions on its own Stripe account, from our ledger. */
  async restaurantMoney(restaurantId: string, from: Date, to: Date) {
    const [r] = await this.db.select().from(restaurants).where(eq(restaurants.id, restaurantId));
    if (!r) throw new Error('Restaurant not found');
    const byAccount = await this.db.select({ account: ledgerEntries.account, cents: sql<number>`sum(${ledgerEntries.amountCents})::bigint` })
      .from(ledgerEntries).where(and(eq(ledgerEntries.restaurantId, restaurantId), gte(ledgerEntries.effectiveAt, from), lt(ledgerEntries.effectiveAt, to))).groupBy(ledgerEntries.account);
    const rows = await this.db.select({ o: orders, q: quotes }).from(orders).innerJoin(quotes, eq(quotes.id, orders.quoteId))
      .where(and(eq(orders.restaurantId, restaurantId), gte(orders.createdAt, from), lt(orders.createdAt, to))).orderBy(desc(orders.createdAt)).limit(200);
    const refundRows = rows.length ? await this.db.select().from(refunds).where(inArray(refunds.orderId, rows.map((x) => x.o.id))).orderBy(desc(refunds.createdAt)) : [];
    return {
      restaurant: { id: r.id, name: r.name, stripeAccountId: r.stripeAccountId, onboardingStatus: r.onboardingStatus, cardPaymentsActive: r.cardPaymentsActive },
      ledger: Object.fromEntries(byAccount.map((b) => [b.account, num(b.cents)])),
      transactions: rows.map(({ o, q }) => ({
        orderId: o.id, status: o.status, createdAt: o.createdAt, paidAt: o.paidAt, paymentIntentId: o.paymentIntentId, chargeId: o.chargeId,
        totalCents: q.totalCents, foodCents: q.foodCents, serviceChargeCents: q.serviceChargeCents, taxCents: q.taxCents, tipCents: q.tipCents,
        deliveryCents: q.deliveryCents, restaurantDeliveryCents: q.restaurantDeliveryCents, applicationFeeCents: o.applicationFeeCents, deliveryFeeShareCents: o.deliveryFeeShareCents,
        stripeFeeCents: o.stripeFeeCents, cardCountry: o.cardCountry, provider: q.provider,
      })),
      refunds: refundRows.map((x) => ({ id: x.id, orderId: x.orderId, createdAt: x.createdAt, chargeRefundCents: x.chargeRefundCents, applicationFeeRefundCents: x.applicationFeeRefundCents, status: x.status, components: x.components })),
    };
  }

  /** Payouts and balance on the restaurant's (or driver's) own Stripe account. */
  async accountPayouts(kind: 'restaurant' | 'driver', id: string) {
    const [row] = kind === 'restaurant'
      ? await this.db.select({ acct: restaurants.stripeAccountId }).from(restaurants).where(eq(restaurants.id, id))
      : await this.db.select({ acct: drivers.stripeAccountId }).from(drivers).where(eq(drivers.id, id));
    if (!row?.acct) return { stripeAccountId: null, balance: null, payouts: [], error: null };
    let balance: Stripe.Balance, payouts: Stripe.ApiList<Stripe.Payout>;
    try {
      [balance, payouts] = await Promise.all([
        this.stripe.balance.retrieve({}, { stripeAccount: row.acct }),
        this.stripe.payouts.list({ limit: 20 }, { stripeAccount: row.acct }),
      ]);
    } catch (e) {
      // Read-only view: show the rest of the page and say why Stripe data is missing.
      return { stripeAccountId: row.acct, balance: null, payouts: [], error: `Stripe didn’t respond: ${(e as Error).message}` };
    }
    const sum = (l: { currency: string; amount: number }[]) => l.filter((b) => b.currency === 'usd').reduce((a, b) => a + b.amount, 0);
    return {
      stripeAccountId: row.acct,
      balance: { availableCents: sum(balance.available), pendingCents: sum(balance.pending ?? []) },
      payouts: payouts.data.map((p) => ({ id: p.id, amountCents: p.amount, status: p.status, arrivalDate: new Date(p.arrival_date * 1000), method: p.method, failureMessage: p.failure_message ?? null })),
      error: null,
    };
  }

  /** Own drivers: per-order transfers (locked pay + 100% tip) and NYC top-ups. */
  async driverSettlements(q: { driverId?: string; status?: string; limit?: number }) {
    const where = [];
    if (q.driverId) where.push(eq(driverTransfers.driverId, q.driverId));
    if (q.status) where.push(sql`${driverTransfers.status} = ${q.status}`);
    const transfers = await this.db.select({ t: driverTransfers, name: drivers.name }).from(driverTransfers).innerJoin(drivers, eq(drivers.id, driverTransfers.driverId))
      .where(where.length ? and(...where) : undefined).orderBy(desc(driverTransfers.createdAt)).limit(q.limit ?? 200);
    const topUps = await this.db.select({ t: driverTopUps, name: drivers.name }).from(driverTopUps).innerJoin(drivers, eq(drivers.id, driverTopUps.driverId))
      .where(q.driverId ? eq(driverTopUps.driverId, q.driverId) : undefined).orderBy(desc(driverTopUps.createdAt)).limit(100);
    return {
      transfers: transfers.map(({ t, name }) => ({ ...t, driverName: name })),
      topUps: topUps.map(({ t, name }) => ({ ...t, driverName: name })),
    };
  }

  /** Third-party couriers: what we owe each provider (quote + full tip) and invoice reconciliation. */
  async supplierObligations(q: { provider?: string; status?: string; limit?: number }) {
    const where = [];
    if (q.provider) where.push(sql`${supplierObligations.provider} = ${q.provider}`);
    if (q.status) where.push(sql`${supplierObligations.status} = ${q.status}`);
    const rows = await this.db.select({ s: supplierObligations, createdAt: orders.createdAt, restaurantId: orders.restaurantId }).from(supplierObligations).innerJoin(orders, eq(orders.id, supplierObligations.orderId))
      .where(where.length ? and(...where) : undefined).orderBy(desc(orders.createdAt)).limit(q.limit ?? 200);
    return rows.map(({ s, createdAt, restaurantId }) => ({ ...s, createdAt, restaurantId, varianceCents: s.actualCents == null ? null : s.actualCents - s.quotedCents }));
  }

  /** Restaurant plans: subscription status and the latest locked tier calculation. */
  async billing() {
    const subs = await this.db.select({ s: subscriptions, name: restaurants.name }).from(subscriptions).innerJoin(restaurants, eq(restaurants.id, subscriptions.subjectId)).where(eq(subscriptions.subjectType, 'restaurant'));
    const snaps = await this.db.select().from(tierSnapshots).where(eq(tierSnapshots.subjectType, 'restaurant')).orderBy(desc(tierSnapshots.period)).limit(500);
    return subs.map(({ s, name }) => ({ restaurantId: s.subjectId, restaurantName: name, status: s.status, stripeSubscriptionId: s.stripeSubscriptionId, latestTier: snaps.find((t) => t.subjectId === s.subjectId) ?? null }));
  }
}
