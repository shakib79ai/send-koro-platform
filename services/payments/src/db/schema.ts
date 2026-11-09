/**
 * Send Koro payments schema (Drizzle / Postgres). Amounts are integer cents.
 * Covers brief §"Required records and controls".
 */
import { sql } from 'drizzle-orm';
import { bigint, boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

const cents = (name: string) => bigint(name, { mode: 'number' }).notNull().default(0);
const created = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const onboardingStatus = pgEnum('onboarding_status', ['not_started', 'pending', 'restricted', 'active']);
export const deliveryProvider = pgEnum('delivery_provider', ['uber_direct', 'doordash_drive', 'own_driver', 'pickup']);
export const orderStatus = pgEnum('order_status', ['awaiting_payment', 'authorized', 'paid', 'declined', 'payment_failed', 'cancelled', 'refunded', 'partially_refunded', 'disputed']);
export const settlementStatus = pgEnum('settlement_status', ['pending', 'owed', 'processing', 'paid', 'failed', 'reversed', 'on_hold']);
export const ledgerState = pgEnum('ledger_state', ['pending', 'available', 'owed', 'paid']);

export const restaurants = pgTable('restaurants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  contactEmail: text('contact_email').notNull(),
  stripeAccountId: text('stripe_account_id').unique(),
  onboardingStatus: onboardingStatus('onboarding_status').notNull().default('not_started'),
  cardPaymentsActive: boolean('card_payments_active').notNull().default(false),
  /** Restaurant accepted "I'm responsible for charging, reporting and paying sales tax". */
  taxResponsibilityAcceptedAt: timestamp('tax_responsibility_accepted_at', { withTimezone: true }),
  createdAt: created(),
});

export const drivers = pgTable('drivers', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  contactEmail: text('contact_email').notNull(),
  stripeAccountId: text('stripe_account_id').unique(),
  onboardingStatus: onboardingStatus('onboarding_status').notNull().default('not_started'),
  transfersActive: boolean('transfers_active').notNull().default(false),
  createdAt: created(),
});

/** Brief §"Delivery consent": every accepted rule is a new immutable version. */
export const deliveryConsents = pgTable('delivery_consents', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id),
  version: integer('version').notNull(),
  rule: jsonb('rule').notNull(),
  perOrderCapCents: bigint('per_order_cap_cents', { mode: 'number' }),
  monthlyBudgetCents: bigint('monthly_budget_cents', { mode: 'number' }),
  validFrom: timestamp('valid_from', { withTimezone: true }).notNull().defaultNow(),
  validTo: timestamp('valid_to', { withTimezone: true }),
  acceptedBy: text('accepted_by').notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [uniqueIndex('delivery_consents_restaurant_version').on(t.restaurantId, t.version)]);

/** Frozen checkout snapshot (F, S, X, D, C, R, T) — brief Order lifecycle step 1. */
export const quotes = pgTable('quotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id),
  consentId: uuid('consent_id').notNull().references(() => deliveryConsents.id),
  consentVersion: integer('consent_version').notNull(),
  provider: deliveryProvider('provider').notNull(),
  providerQuoteId: text('provider_quote_id'),
  foodCents: cents('food_cents'),
  serviceChargeCents: cents('service_charge_cents'),
  taxCents: cents('tax_cents'),
  /** Who the tax is payable to under the approved arrangement. */
  taxRecipient: text('tax_recipient').notNull().default('restaurant'),
  taxBreakdown: jsonb('tax_breakdown').notNull().default(sql`'[]'::jsonb`),
  tipCents: cents('tip_cents'),
  deliveryCents: cents('delivery_cents'),
  /** P: the courier price before markup (what the provider quoted). D = P + payout markup + card markup. */
  courierCents: integer('courier_cents').notNull().default(0),
  payoutMarkupCents: integer('payout_markup_cents').notNull().default(0),
  cardMarkupCents: integer('card_markup_cents').notNull().default(0),
  customerDeliveryCents: cents('customer_delivery_cents'),
  restaurantDeliveryCents: cents('restaurant_delivery_cents'),
  totalCents: cents('total_cents'),
  applicationFeeCents: cents('application_fee_cents'),
  /** Estimated processing fee share borne by the delivery money (domestic card estimate). */
  estDeliveryFeeShareCents: cents('est_delivery_fee_share_cents'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: created(),
});

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id),
  quoteId: uuid('quote_id').notNull().references(() => quotes.id).unique(),
  status: orderStatus('status').notNull().default('awaiting_payment'),
  stripeAccountId: text('stripe_account_id').notNull(),
  paymentIntentId: text('payment_intent_id').unique(),
  chargeId: text('charge_id'),
  applicationFeeId: text('application_fee_id'),
  /** application_fee_amount actually captured = D + T − delivery fee share. */
  applicationFeeCents: bigint('application_fee_cents', { mode: 'number' }),
  deliveryFeeShareCents: bigint('delivery_fee_share_cents', { mode: 'number' }),
  cardCountry: text('card_country'),
  stripeFeeCents: bigint('stripe_fee_cents', { mode: 'number' }),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  createdAt: created(),
}, (t) => [index('orders_restaurant_paid').on(t.restaurantId, t.paidAt)]);

/** Per-order ledger: separates food, tax, delivery allocation, tips and fees; tracks state. */
export const ledgerEntries = pgTable('ledger_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id),
  restaurantId: uuid('restaurant_id').notNull(),
  account: text('account').notNull(), // restaurant_food | restaurant_service | restaurant_tax | restaurant_delivery_contribution | delivery_allocation | driver_tip | stripe_fee | refund_food | ...
  amountCents: bigint('amount_cents', { mode: 'number' }).notNull(),
  state: ledgerState('state').notNull().default('pending'),
  ref: text('ref'),
  /** Idempotency: the same event never writes the same entry twice. */
  dedupeKey: text('dedupe_key').notNull().unique(),
  effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('ledger_restaurant_account_time').on(t.restaurantId, t.account, t.effectiveAt)]);

export const refunds = pgTable('refunds', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  components: jsonb('components').notNull(),
  chargeRefundCents: cents('charge_refund_cents'),
  applicationFeeRefundCents: cents('application_fee_refund_cents'),
  stripeRefundId: text('stripe_refund_id'),
  stripeFeeRefundId: text('stripe_fee_refund_id'),
  status: text('status').notNull().default('pending'),
  createdAt: created(),
});

export const fulfillments = pgTable('fulfillments', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id).unique(),
  provider: deliveryProvider('provider').notNull(),
  driverId: uuid('driver_id').references(() => drivers.id),
  providerDeliveryId: text('provider_delivery_id'),
  /** Own drivers: the locked offer pay shown before accepting (never lowered). */
  driverPayCents: bigint('driver_pay_cents', { mode: 'number' }),
  actualCostCents: bigint('actual_cost_cents', { mode: 'number' }),
  tipCents: cents('tip_cents'),
  status: text('status').notNull().default('assigned'),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

/** Own-network driver transfers — unique per order so repeated completion events cannot pay twice. */
export const driverTransfers = pgTable('driver_transfers', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id).unique(),
  driverId: uuid('driver_id').notNull().references(() => drivers.id),
  payCents: cents('pay_cents'),
  tipCents: cents('tip_cents'),
  amountCents: cents('amount_cents'),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  stripeTransferId: text('stripe_transfer_id'),
  status: settlementStatus('status').notNull().default('pending'),
  lastError: text('last_error'),
  createdAt: created(),
});

/** Third-party fulfilment obligations (Uber Direct / DoorDash Drive) — paid by invoice, not Connect. */
export const supplierObligations = pgTable('supplier_obligations', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id).unique(),
  provider: deliveryProvider('provider').notNull(),
  providerDeliveryId: text('provider_delivery_id'),
  quotedCents: cents('quoted_cents'),
  actualCents: bigint('actual_cents', { mode: 'number' }),
  tipCents: cents('tip_cents'),
  tipSubmittedAt: timestamp('tip_submitted_at', { withTimezone: true }),
  invoiceRef: text('invoice_ref'),
  status: settlementStatus('status').notNull().default('pending'),
});

export const stripeEvents = pgTable('stripe_events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  account: text('account'),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  error: text('error'),
});

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  subjectType: text('subject_type').notNull(), // restaurant | driver
  subjectId: uuid('subject_id').notNull(),
  stripeSubscriptionId: text('stripe_subscription_id').notNull().unique(),
  stripeItemId: text('stripe_item_id').notNull(),
  currentPriceId: text('current_price_id').notNull(),
  status: text('status').notNull(),
}, (t) => [uniqueIndex('subscriptions_subject').on(t.subjectType, t.subjectId)]);

/** Locked monthly tier calculation (brief: period, food sales, refunds, base, rule version, price, invoice). */
export const tierSnapshots = pgTable('tier_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  subjectType: text('subject_type').notNull(),
  subjectId: uuid('subject_id').notNull(),
  period: text('period').notNull(),
  foodSalesCents: cents('food_sales_cents'),
  foodRefundsCents: cents('food_refunds_cents'),
  netBaseCents: bigint('net_base_cents', { mode: 'number' }).notNull(),
  ruleVersion: text('rule_version').notNull(),
  priceLookupKey: text('price_lookup_key').notNull(),
  priceId: text('price_id').notNull(),
  invoiceId: text('invoice_id'),
  createdAt: created(),
}, (t) => [uniqueIndex('tier_snapshots_subject_period').on(t.subjectType, t.subjectId, t.period)]);

/**
 * NYC minimum pay weekly top-up (BUSINESS_MODEL.md §Own drivers): when a week's locked pay is
 * below $22.13 × trip hours, the shortfall is transferred once per driver per week. Tips never count.
 */
export const driverTopUps = pgTable('driver_top_ups', {
  id: uuid('id').primaryKey().defaultRandom(),
  driverId: uuid('driver_id').notNull().references(() => drivers.id),
  /** Monday of the pay week (New York date, YYYY-MM-DD). */
  weekStart: text('week_start').notNull(),
  tripSeconds: integer('trip_seconds').notNull(),
  minimumCents: cents('minimum_cents'),
  paidCents: cents('paid_cents'),
  amountCents: cents('amount_cents'),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  stripeTransferId: text('stripe_transfer_id'),
  status: settlementStatus('status').notNull().default('pending'),
  lastError: text('last_error'),
  createdAt: created(),
}, (t) => [uniqueIndex('driver_top_ups_driver_week').on(t.driverId, t.weekStart)]);
