/**
 * Send Koro core API schema (Drizzle / Postgres). All money is integer cents.
 * Payment truth (Stripe charges, application fees, transfers, ledger) lives in services/payments;
 * rows here carry the payments IDs and snapshots shown to people.
 */
import { sql } from 'drizzle-orm';
import {
  bigint, boolean, doublePrecision, index, integer, jsonb, pgEnum, pgTable, primaryKey, smallint, text, time, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core';

const cents = (name: string) => bigint(name, { mode: 'number' }).notNull().default(0);
const created = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updated = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

// ── People and sign-in ──────────────────────────────────────────────────────
export const userRole = pgEnum('user_role', ['customer', 'restaurant_staff', 'driver', 'admin']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  phone: text('phone').notNull(),
  role: userRole('role').notNull(),
  name: text('name'),
  email: text('email'),
  disabledAt: timestamp('disabled_at', { withTimezone: true }),
  createdAt: created(),
}, (t) => [uniqueIndex('users_phone_role').on(t.phone, t.role)]);

export const otpCodes = pgTable('otp_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  phone: text('phone').notNull(),
  role: userRole('role').notNull(),
  codeHash: text('code_hash').notNull(),
  attempts: smallint('attempts').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: created(),
}, (t) => [index('otp_phone_role').on(t.phone, t.role)]);

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: created(),
});

export const addressLabel = pgEnum('address_label', ['home', 'office', 'other']);
export const addresses = pgTable('addresses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  label: addressLabel('label').notNull(),
  customLabel: text('custom_label'),
  line1: text('line1').notNull(),
  line2: text('line2'),
  city: text('city').notNull(),
  state: text('state').notNull(),
  postalCode: text('postal_code').notNull(),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  dropoffInstructions: text('dropoff_instructions'),
  isDefault: boolean('is_default').notNull().default(false),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: created(),
}, (t) => [index('addresses_user').on(t.userId)]);

export const deviceTokens = pgTable('device_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  platform: text('platform').notNull(), // ios | android | web
  token: text('token').notNull().unique(),
  createdAt: created(),
});

// ── Restaurants ─────────────────────────────────────────────────────────────
export const restaurantStatus = pgEnum('restaurant_status', ['onboarding', 'live', 'paused', 'suspended']);
export const memberRole = pgEnum('member_role', ['owner', 'manager', 'staff']);

export const restaurants = pgTable('restaurants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  contactEmail: text('contact_email').notNull(),
  cuisine: text('cuisine'),
  status: restaurantStatus('status').notNull().default('onboarding'),
  /** Mirrors payments: "I'm responsible for charging, reporting and paying sales tax." */
  taxResponsibilityAcceptedAt: timestamp('tax_responsibility_accepted_at', { withTimezone: true }),
  /** Latest delivery fee rule as accepted (versioned history lives in services/payments). */
  deliveryRule: jsonb('delivery_rule'),
  deliveryRuleVersion: integer('delivery_rule_version'),
  payoutsReady: boolean('payouts_ready').notNull().default(false),
  createdAt: created(),
});

export const restaurantMembers = pgTable('restaurant_members', {
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  role: memberRole('role').notNull(),
  createdAt: created(),
}, (t) => [primaryKey({ columns: [t.restaurantId, t.userId] })]);

export const locations = pgTable('locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id),
  name: text('name').notNull(),
  phone: text('phone'),
  line1: text('line1').notNull(),
  city: text('city').notNull(),
  state: text('state').notNull(),
  postalCode: text('postal_code').notNull(),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  timezone: text('timezone').notNull().default('America/New_York'),
  deliveryRadiusMeters: integer('delivery_radius_meters').notNull().default(4800),
  /** Restaurant-set sales tax rate in parts per million (88750 = 8.875%). The restaurant remits it. */
  taxRatePpm: integer('tax_rate_ppm').notNull().default(0),
  prepMinutes: integer('prep_minutes').notNull().default(20),
  acceptingOrders: boolean('accepting_orders').notNull().default(true),
  busyUntil: timestamp('busy_until', { withTimezone: true }),
  pickupEnabled: boolean('pickup_enabled').notNull().default(true),
  deliveryEnabled: boolean('delivery_enabled').notNull().default(true),
  createdAt: created(),
}, (t) => [index('locations_restaurant').on(t.restaurantId)]);

export const locationHours = pgTable('location_hours', {
  id: uuid('id').primaryKey().defaultRandom(),
  locationId: uuid('location_id').notNull().references(() => locations.id, { onDelete: 'cascade' }),
  dayOfWeek: smallint('day_of_week').notNull(), // 0 = Sunday
  opensAt: time('opens_at').notNull(),
  closesAt: time('closes_at').notNull(), // may be earlier than opensAt → closes after midnight
}, (t) => [index('hours_location').on(t.locationId)]);

/** Restaurant-set extra fees, shown on the menu and in the cart before payment. */
export const feeKind = pgEnum('fee_kind', ['service_charge', 'mandatory_gratuity', 'packaging_fee', 'large_order_fee']);
export const restaurantFees = pgTable('restaurant_fees', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id),
  kind: feeKind('kind').notNull(),
  label: text('label').notNull(),
  /** Either a percentage of food (bps) or a fixed amount. */
  rateBps: integer('rate_bps'),
  fixedCents: bigint('fixed_cents', { mode: 'number' }),
  /** Applies only when food subtotal ≥ this (large-order fees). */
  minFoodCents: bigint('min_food_cents', { mode: 'number' }),
  taxable: boolean('taxable').notNull().default(true),
  active: boolean('active').notNull().default(true),
  createdAt: created(),
});

// ── Menu ────────────────────────────────────────────────────────────────────
export const menuCategories = pgTable('menu_categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const menuItems = pgTable('menu_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id),
  categoryId: uuid('category_id').references(() => menuCategories.id),
  name: text('name').notNull(),
  description: text('description'),
  priceCents: cents('price_cents'),
  imageUrl: text('image_url'),
  allergens: jsonb('allergens').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  dietary: jsonb('dietary').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  taxable: boolean('taxable').notNull().default(true),
  available: boolean('available').notNull().default(true),
  soldOutUntil: timestamp('sold_out_until', { withTimezone: true }),
  sortOrder: integer('sort_order').notNull().default(0),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index('menu_items_restaurant').on(t.restaurantId)]);

export const modifierGroups = pgTable('modifier_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  itemId: uuid('item_id').notNull().references(() => menuItems.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  minSelect: smallint('min_select').notNull().default(0),
  maxSelect: smallint('max_select').notNull().default(1),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const modifierOptions = pgTable('modifier_options', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => modifierGroups.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  priceCents: cents('price_cents'),
  available: boolean('available').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
});

// ── Orders ──────────────────────────────────────────────────────────────────
export const orderStatus = pgEnum('order_status', [
  'pending_payment', 'placed', 'accepted', 'preparing', 'ready', 'picked_up', 'delivered', 'completed', 'declined', 'cancelled',
]);
export const fulfilmentType = pgEnum('fulfilment_type', ['delivery', 'pickup']);
export const deliveryProvider = pgEnum('delivery_provider', ['uber_direct', 'doordash_drive', 'own_driver']);

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Short code shown to staff and couriers, e.g. "SK-4821". */
  code: text('code').notNull().unique(),
  customerId: uuid('customer_id').notNull().references(() => users.id),
  restaurantId: uuid('restaurant_id').notNull().references(() => restaurants.id),
  locationId: uuid('location_id').notNull().references(() => locations.id),
  fulfilment: fulfilmentType('fulfilment').notNull(),
  status: orderStatus('status').notNull().default('pending_payment'),
  /** Snapshot of the cart and the delivery address at checkout. */
  items: jsonb('items').notNull(),
  dropoff: jsonb('dropoff'),
  notes: text('notes'),
  foodCents: cents('food_cents'),
  serviceChargeCents: cents('service_charge_cents'),
  taxCents: cents('tax_cents'),
  tipCents: cents('tip_cents'),
  deliveryCents: cents('delivery_cents'),
  customerDeliveryCents: cents('customer_delivery_cents'),
  restaurantDeliveryCents: cents('restaurant_delivery_cents'),
  totalCents: cents('total_cents'),
  /** Customer receipt lines exactly as shown at checkout (never names the courier company). */
  receipt: jsonb('receipt').notNull(),
  paymentsQuoteId: text('payments_quote_id'),
  paymentsOrderId: text('payments_order_id').unique(),
  deliveryQuote: jsonb('delivery_quote'),
  /** Client-generated key so a double-tapped "Place order" creates one order. */
  idempotencyKey: text('idempotency_key').notNull(),
  placedAt: timestamp('placed_at', { withTimezone: true }),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  readyAt: timestamp('ready_at', { withTimezone: true }),
  pickedUpAt: timestamp('picked_up_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancelReason: text('cancel_reason'),
  createdAt: created(),
}, (t) => [
  uniqueIndex('orders_customer_idempotency').on(t.customerId, t.idempotencyKey),
  index('orders_restaurant_status').on(t.restaurantId, t.status),
  index('orders_customer').on(t.customerId),
]);

export const orderEvents = pgTable('order_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id),
  type: text('type').notNull(),
  actor: text('actor').notNull(),
  data: jsonb('data'),
  createdAt: created(),
}, (t) => [index('order_events_order').on(t.orderId)]);

// ── Delivery ────────────────────────────────────────────────────────────────
export const deliveryStatus = pgEnum('delivery_status', [
  'requested', 'offered', 'assigned', 'at_pickup', 'picked_up', 'at_dropoff', 'delivered', 'cancelled', 'failed',
]);

export const deliveries = pgTable('deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  orderId: uuid('order_id').notNull().references(() => orders.id).unique(),
  provider: deliveryProvider('provider').notNull(),
  providerDeliveryId: text('provider_delivery_id'),
  status: deliveryStatus('status').notNull().default('requested'),
  driverId: uuid('driver_id').references(() => drivers.id),
  trackingUrl: text('tracking_url'),
  /** Admin-only: what the courier company quoted. Never sent to customers. */
  providerQuoteCents: bigint('provider_quote_cents', { mode: 'number' }),
  /** Own drivers: the locked offer pay (never reduced). */
  driverPayCents: bigint('driver_pay_cents', { mode: 'number' }),
  distanceMeters: integer('distance_meters'),
  durationSeconds: integer('duration_seconds'),
  batchId: uuid('batch_id'),
  proofPhotoUrl: text('proof_photo_url'),
  pickedUpAt: timestamp('picked_up_at', { withTimezone: true }),
  deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  createdAt: created(),
}, (t) => [index('deliveries_driver').on(t.driverId)]);

export const driverStatus = pgEnum('driver_status', ['applied', 'approved', 'suspended']);
export const drivers = pgTable('drivers', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id).unique(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  vehicle: text('vehicle').notNull().default('bike'), // bike | ebike | car | walk
  status: driverStatus('status').notNull().default('applied'),
  online: boolean('online').notNull().default(false),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  locationAt: timestamp('location_at', { withTimezone: true }),
  payoutsReady: boolean('payouts_ready').notNull().default(false),
  createdAt: created(),
});

export const offerStatus = pgEnum('offer_status', ['open', 'accepted', 'declined', 'expired', 'withdrawn']);
/** Upfront, locked offers: distance, total time and pay shown before the driver accepts. */
export const driverOffers = pgTable('driver_offers', {
  id: uuid('id').primaryKey().defaultRandom(),
  driverId: uuid('driver_id').notNull().references(() => drivers.id),
  batchId: uuid('batch_id').notNull(),
  orderIds: jsonb('order_ids').$type<string[]>().notNull(),
  distanceMeters: integer('distance_meters').notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
  payCents: cents('pay_cents'),
  /** Per-order split of payCents (sums exactly to payCents). */
  payPerOrder: jsonb('pay_per_order').$type<Record<string, number>>().notNull(),
  status: offerStatus('status').notNull().default('open'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  createdAt: created(),
}, (t) => [
  index('offers_driver_status').on(t.driverId, t.status),
  // At most one accepted offer per batch.
  uniqueIndex('offers_batch_accepted').on(t.batchId).where(sql`status = 'accepted'`),
]);

/** Trip time per delivery, used for the NYC minimum-pay weekly check. */
export const driverTrips = pgTable('driver_trips', {
  id: uuid('id').primaryKey().defaultRandom(),
  driverId: uuid('driver_id').notNull().references(() => drivers.id),
  batchId: uuid('batch_id').notNull().unique(),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  payCents: cents('pay_cents'),
});
