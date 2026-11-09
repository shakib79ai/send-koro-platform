/**
 * Checkout — brief §"Order lifecycle" steps 1–3 and §"Proposed direct charge routing".
 *
 *  1. quote(): freeze F, S, X, D, C, R, T against the restaurant's current delivery consent.
 *  2. createPayment(): one order + one PaymentIntent created IN THE RESTAURANT'S ACCOUNT
 *     (Stripe-Account header) with application_fee_amount = D + T. No transfer_data, no
 *     platform charge — food money never touches Send Koro's balance.
 *     capture_method = manual: the card is authorised at checkout and captured only when the
 *     restaurant accepts, so a declined order is never a paid, unfulfillable order.
 *  3. accept()/decline(): capture or cancel; fulfilment starts on payment_intent.succeeded.
 */
import type Stripe from 'stripe';
import { and, desc, eq, isNull, lte, or, gt } from 'drizzle-orm';
import type { Db } from '../db/client';
import { deliveryConsents, orders, quotes, restaurants } from '../db/schema';
import { Allocation, AllocationError, applicationFeeAfterShare, customerBreakdown, deliveryFeeShare, DeliveryConsent, DeliveryRule, estimateStripeFee, FeeEstimate, PayoutCost, priceDelivery, validateAllocation } from '../core/allocation';

export interface DeliveryMarkupConfig { enabled: boolean; ownDriver: PayoutCost; thirdParty: PayoutCost }
const NO_MARKUP: DeliveryMarkupConfig = { enabled: false, ownDriver: { bps: 0, fixedCents: 0 }, thirdParty: { bps: 0, fixedCents: 0 } };

export interface QuoteRequest {
  restaurantId: string;
  foodCents: number;
  serviceChargeCents?: number;
  taxCents?: number;
  taxBreakdown?: { label: string; rateBps: number; amountCents: number }[];
  tipCents?: number;
  delivery:
    | { provider: 'pickup' }
    /** deliveryCents is the courier price P (provider quote). The delivery price D adds the markup when enabled. */
    | { provider: 'uber_direct' | 'doordash_drive' | 'own_driver'; providerQuoteId?: string; deliveryCents: number; expiresAt: Date };
}

export class CheckoutService {
  constructor(
    private readonly stripe: Stripe, private readonly db: Db, private readonly fee: FeeEstimate,
    private readonly now: () => Date = () => new Date(),
    private readonly markup: DeliveryMarkupConfig = NO_MARKUP,
  ) {}

  async activeConsent(restaurantId: string) {
    const at = this.now();
    const [c] = await this.db.select().from(deliveryConsents)
      .where(and(eq(deliveryConsents.restaurantId, restaurantId), lte(deliveryConsents.validFrom, at), or(isNull(deliveryConsents.validTo), gt(deliveryConsents.validTo, at))))
      .orderBy(desc(deliveryConsents.version)).limit(1);
    return c;
  }

  async quote(req: QuoteRequest) {
    const [r] = await this.db.select().from(restaurants).where(eq(restaurants.id, req.restaurantId));
    if (!r) throw new Error('Restaurant not found');
    if (!r.taxResponsibilityAcceptedAt) throw new AllocationError('rule_not_authorized', 'Restaurant has not accepted tax responsibility');
    const consentRow = await this.activeConsent(r.id);
    if (!consentRow) throw new AllocationError('rule_not_authorized', 'Restaurant has no accepted delivery fee rule');

    const isPickup = req.delivery.provider === 'pickup';
    const P = req.delivery.provider === 'pickup' ? 0 : req.delivery.deliveryCents;
    const consent: DeliveryConsent = {
      rule: consentRow.rule as DeliveryRule,
      perOrderCapCents: consentRow.perOrderCapCents ?? undefined,
      version: consentRow.version,
    };
    const payout = !this.markup.enabled || isPickup ? { bps: 0, fixedCents: 0 } : req.delivery.provider === 'own_driver' ? this.markup.ownDriver : this.markup.thirdParty;
    // With the markup off, the price is just P (cardMarkup forced to 0 by using a zero fee estimate for pricing).
    const priced = priceDelivery({
      foodCents: req.foodCents,
      serviceChargeCents: req.serviceChargeCents ?? 0,
      restaurantTaxCents: req.taxCents ?? 0,
      tipCents: isPickup ? 0 : req.tipCents ?? 0,
      courierCents: P,
      consent,
    }, this.markup.enabled && !isPickup ? this.fee : { bps: 0, fixedCents: 0 }, payout);
    const a = priced.allocation;
    validateAllocation(a, this.fee);
    const estShare = deliveryFeeShare(a, estimateStripeFee(a.Q, this.fee));

    const expiresAt = req.delivery.provider === 'pickup' ? new Date(this.now().getTime() + 15 * 60_000) : req.delivery.expiresAt;
    if (expiresAt <= this.now()) throw new AllocationError('quote_expired', 'Delivery quote already expired');

    const [q] = await this.db.insert(quotes).values({
      restaurantId: r.id, consentId: consentRow.id, consentVersion: consentRow.version,
      provider: req.delivery.provider, providerQuoteId: req.delivery.provider === 'pickup' ? null : req.delivery.providerQuoteId ?? null,
      foodCents: a.F, serviceChargeCents: a.S, taxCents: a.X, taxRecipient: 'restaurant', taxBreakdown: req.taxBreakdown ?? [],
      tipCents: a.T, deliveryCents: a.D, courierCents: priced.courierCents, payoutMarkupCents: priced.payoutMarkupCents, cardMarkupCents: priced.cardMarkupCents,
      customerDeliveryCents: a.C, restaurantDeliveryCents: a.R,
      totalCents: a.Q, applicationFeeCents: a.A, estDeliveryFeeShareCents: estShare, expiresAt,
    }).returning();
    // stripeAccount lets the app initialise Stripe.js for this restaurant before the order exists (deferred intent).
    return { quoteId: q.id, expiresAt, allocation: a, estDeliveryFeeShareCents: estShare, courierCents: priced.courierCents, payoutMarkupCents: priced.payoutMarkupCents, cardMarkupCents: priced.cardMarkupCents, customer: customerBreakdown(a, r.name), stripeAccount: r.stripeAccountId };
  }

  async createPayment(quoteId: string) {
    const [q] = await this.db.select().from(quotes).where(eq(quotes.id, quoteId));
    if (!q) throw new Error('Quote not found');
    if (q.expiresAt <= this.now()) throw new AllocationError('quote_expired', 'Quote expired — request a new delivery quote');
    const [r] = await this.db.select().from(restaurants).where(eq(restaurants.id, q.restaurantId));
    if (!r?.stripeAccountId || !r.cardPaymentsActive) throw new Error('Restaurant cannot accept card payments yet');

    // One order per quote (unique quote_id). A retry returns the same order + PaymentIntent.
    const existing = await this.db.select().from(orders).where(eq(orders.quoteId, q.id));
    let order = existing[0];
    if (!order) {
      [order] = await this.db.insert(orders).values({ restaurantId: r.id, quoteId: q.id, stripeAccountId: r.stripeAccountId })
        .onConflictDoNothing({ target: orders.quoteId }).returning();
      if (!order) [order] = await this.db.select().from(orders).where(eq(orders.quoteId, q.id));
    }

    const pi = await this.stripe.paymentIntents.create(
      {
        amount: q.totalCents,
        currency: 'usd',
        // Provisional: D + T minus the delivery's estimated fee share. Finalised at capture from the real card.
        application_fee_amount: (q.applicationFeeCents - q.estDeliveryFeeShareCents) || undefined,
        capture_method: 'manual',
        automatic_payment_methods: { enabled: true },
        description: `Send Koro order ${order.id} · ${r.name}`,
        transfer_group: `order_${order.id}`,
        metadata: {
          send_koro_order_id: order.id,
          send_koro_quote_id: q.id,
          send_koro_restaurant_id: r.id,
          consent_version: String(q.consentVersion),
          F: String(q.foodCents), S: String(q.serviceChargeCents), X: String(q.taxCents),
          D: String(q.deliveryCents), C: String(q.customerDeliveryCents), R: String(q.restaurantDeliveryCents), T: String(q.tipCents),
          allocation: 'delivery_fulfillment', // application_fee_amount = delivery budget + driver tip, never a food commission
        },
      },
      { stripeAccount: r.stripeAccountId, idempotencyKey: `order-pi:${order.id}` },
    );
    await this.db.update(orders).set({ paymentIntentId: pi.id }).where(eq(orders.id, order.id));
    await this.db.update(quotes).set({ usedAt: this.now() }).where(and(eq(quotes.id, q.id), isNull(quotes.usedAt)));
    // Stripe.js must be initialised with { stripeAccount } for direct charges.
    return { orderId: order.id, paymentIntentId: pi.id, clientSecret: pi.client_secret, stripeAccount: r.stripeAccountId, totalCents: q.totalCents };
  }

  /**
   * Restaurant accepted → capture. The card is known now (authorised charge), so the delivery's share
   * of the processing fee is recomputed for that card (international cards cost more) and the final
   * application_fee_amount = D + T − share is set on capture.
   */
  async accept(orderId: string) {
    const o = await this.loadOrder(orderId);
    const [q] = await this.db.select().from(quotes).where(eq(quotes.id, o.quoteId));
    const pi = await this.stripe.paymentIntents.retrieve(o.paymentIntentId!, { expand: ['latest_charge'] }, { stripeAccount: o.stripeAccountId });
    const charge = typeof pi.latest_charge === 'object' ? pi.latest_charge : null;
    const country = charge?.payment_method_details?.card?.country ?? null;
    const a = allocationFromQuote(q);
    const share = deliveryFeeShare(a, estimateStripeFee(a.Q, this.fee, country));
    const applicationFee = applicationFeeAfterShare(a, estimateStripeFee(a.Q, this.fee, country));
    await this.db.update(orders).set({ applicationFeeCents: applicationFee, deliveryFeeShareCents: share, cardCountry: country }).where(eq(orders.id, o.id));
    return this.stripe.paymentIntents.capture(
      o.paymentIntentId!,
      applicationFee > 0 ? { application_fee_amount: applicationFee } : {},
      { stripeAccount: o.stripeAccountId, idempotencyKey: `order-capture:${o.id}` },
    );
  }

  /**
   * Has the customer finished paying? Asked by the core API right after the app confirms the
   * PaymentIntent (and by its sweep job, in case the app closed). Read-only apart from marking
   * the order authorised, which the webhook also does.
   */
  async paymentStatus(orderId: string) {
    const o = await this.loadOrder(orderId);
    const pi = await this.stripe.paymentIntents.retrieve(o.paymentIntentId!, {}, { stripeAccount: o.stripeAccountId });
    if (pi.status === 'requires_capture' && o.status === 'awaiting_payment') {
      await this.db.update(orders).set({ status: 'authorized' }).where(and(eq(orders.id, o.id), eq(orders.status, 'awaiting_payment')));
    }
    return { orderId: o.id, paymentIntentStatus: pi.status, authorized: pi.status === 'requires_capture' || pi.status === 'succeeded' };
  }

  /** Restaurant declined, the customer cancelled before acceptance, or the 5-minute auto-decline fired → release the authorisation. */
  async decline(orderId: string, reason: 'restaurant_declined' | 'auto_declined' | 'customer_cancelled') {
    const o = await this.loadOrder(orderId);
    const pi = await this.stripe.paymentIntents.cancel(o.paymentIntentId!, { cancellation_reason: 'abandoned' }, { stripeAccount: o.stripeAccountId, idempotencyKey: `order-cancel:${o.id}` });
    await this.db.update(orders).set({ status: 'declined' }).where(eq(orders.id, o.id));
    return { paymentIntent: pi, reason };
  }

  private async loadOrder(orderId: string) {
    const [o] = await this.db.select().from(orders).where(eq(orders.id, orderId));
    if (!o?.paymentIntentId) throw new Error('Order has no PaymentIntent');
    return o;
  }
}

export function allocationFromQuote(q: typeof quotes.$inferSelect): Allocation {
  return {
    F: q.foodCents, S: q.serviceChargeCents, X: q.taxCents, T: q.tipCents,
    D: q.deliveryCents, R: q.restaurantDeliveryCents, C: q.customerDeliveryCents,
    Q: q.totalCents, A: q.applicationFeeCents, restaurantRetained: q.totalCents - q.applicationFeeCents,
  };
}
