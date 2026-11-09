/**
 * Restaurant portal: profile, locations, hours, team, delivery fee rule, taxes & fees, Stripe
 * payouts setup and going live. Every rule change that affects money is forwarded to the payments
 * service, which keeps the versioned record (delivery consents, tax acceptance).
 */
import { and, asc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/client';
import { locationHours, locations, restaurantFees, restaurantMembers, restaurants, users } from '../db/schema';
import type { DeliveryRule, PaymentsClient } from '../integrations/payments.client';
import { badRequest, conflict, forbidden, notFound } from '../common/http';
import { stateLaunchCheck, suggestTaxRatePpm } from '../core/tax';
import type { AuthUser } from '../auth/auth.guard';

type MemberRole = 'owner' | 'manager' | 'staff';
const RANK: Record<MemberRole, number> = { staff: 1, manager: 2, owner: 3 };

export interface LocationInput {
  name: string; phone?: string; line1: string; city: string; state: string; postalCode: string; lat: number; lng: number;
  deliveryRadiusMeters?: number; prepMinutes?: number; pickupEnabled?: boolean; deliveryEnabled?: boolean;
}
export interface FeeInput {
  kind: 'service_charge' | 'mandatory_gratuity' | 'packaging_fee' | 'large_order_fee'; label: string;
  rateBps?: number | null; fixedCents?: number | null; minFoodCents?: number | null; taxable?: boolean; active?: boolean;
}

export class RestaurantsService {
  constructor(private readonly db: Db, private readonly payments: PaymentsClient) {}

  /** Throws unless the user is a member with at least `min` role. Admins pass. */
  async requireMember(user: AuthUser, restaurantId: string, min: MemberRole = 'staff') {
    if (user.role === 'admin') return 'owner' as MemberRole;
    const [m] = await this.db.select().from(restaurantMembers).where(and(eq(restaurantMembers.restaurantId, restaurantId), eq(restaurantMembers.userId, user.id)));
    if (!m) throw forbidden('You are not on this restaurant’s team');
    if (RANK[m.role] < RANK[min]) throw forbidden(`Only a${min === 'owner' ? 'n owner' : ' manager'} can do this`);
    return m.role;
  }

  async requireLocation(user: AuthUser, locationId: string, min: MemberRole = 'staff') {
    const [l] = await this.db.select().from(locations).where(eq(locations.id, locationId));
    if (!l) throw notFound('Location');
    await this.requireMember(user, l.restaurantId, min);
    return l;
  }

  async create(owner: AuthUser, input: { name: string; contactEmail: string; cuisine?: string }) {
    const r = await this.db.transaction(async (tx) => {
      const [row] = await tx.insert(restaurants).values(input).returning();
      await tx.insert(restaurantMembers).values({ restaurantId: row.id, userId: owner.id, role: 'owner' });
      return row;
    });
    await this.payments.upsertRestaurant({ id: r.id, name: r.name, contactEmail: r.contactEmail });
    return r;
  }

  async mine(user: AuthUser) {
    const rows = await this.db.select({ r: restaurants, role: restaurantMembers.role }).from(restaurantMembers)
      .innerJoin(restaurants, eq(restaurants.id, restaurantMembers.restaurantId)).where(eq(restaurantMembers.userId, user.id));
    return rows.map(({ r, role }) => ({ ...r, myRole: role }));
  }

  async get(user: AuthUser, id: string) {
    await this.requireMember(user, id);
    let [r] = await this.db.select().from(restaurants).where(eq(restaurants.id, id));
    if (!r) throw notFound('Restaurant');
    if (!r.payoutsReady) {
      // Stripe onboarding finishes on Stripe's site; pull the result from the payments service.
      const st = await this.payments.restaurantStatus(id).catch(() => null);
      if (st?.ready) [r] = await this.db.update(restaurants).set({ payoutsReady: true }).where(eq(restaurants.id, id)).returning();
    }
    const locs = await this.db.select().from(locations).where(eq(locations.restaurantId, id)).orderBy(asc(locations.createdAt));
    const hours = locs.length ? await this.db.select().from(locationHours).where(inArray(locationHours.locationId, locs.map((l) => l.id))) : [];
    const fees = await this.db.select().from(restaurantFees).where(eq(restaurantFees.restaurantId, id));
    return { ...r, locations: locs.map((l) => ({ ...l, hours: hours.filter((h) => h.locationId === l.id) })), fees, checklist: this.checklist(r, locs, hours.length) };
  }

  async update(user: AuthUser, id: string, input: { name?: string; contactEmail?: string; cuisine?: string }) {
    await this.requireMember(user, id, 'owner');
    const [r] = await this.db.update(restaurants).set(input).where(eq(restaurants.id, id)).returning();
    await this.payments.upsertRestaurant({ id: r.id, name: r.name, contactEmail: r.contactEmail });
    return r;
  }

  // ── Locations & hours ──
  async addLocation(user: AuthUser, restaurantId: string, input: LocationInput) {
    await this.requireMember(user, restaurantId, 'owner');
    const check = stateLaunchCheck(input.state);
    if (!check.allowed) throw badRequest('state_not_available', check.reason!);
    const suggestion = suggestTaxRatePpm(input.state, input.postalCode);
    const [l] = await this.db.insert(locations).values({ ...input, restaurantId, taxRatePpm: suggestion.ratePpm ?? 0 }).returning();
    return { ...l, taxSuggestion: suggestion };
  }

  async updateLocation(user: AuthUser, locationId: string, input: Partial<LocationInput> & { acceptingOrders?: boolean; busyMinutes?: number | null }) {
    const loc = await this.requireLocation(user, locationId, 'manager');
    const { busyMinutes, ...rest } = input;
    if (rest.state && rest.state !== loc.state) {
      const check = stateLaunchCheck(rest.state);
      if (!check.allowed) throw badRequest('state_not_available', check.reason!);
    }
    const set: Partial<typeof locations.$inferInsert> = { ...rest };
    if (busyMinutes !== undefined) set.busyUntil = busyMinutes ? new Date(Date.now() + busyMinutes * 60_000) : null;
    const [l] = await this.db.update(locations).set(set).where(eq(locations.id, locationId)).returning();
    return l;
  }

  /** Replaces the week's hours for a location. */
  async setHours(user: AuthUser, locationId: string, hours: { dayOfWeek: number; opensAt: string; closesAt: string }[]) {
    await this.requireLocation(user, locationId, 'manager');
    return this.db.transaction(async (tx) => {
      await tx.delete(locationHours).where(eq(locationHours.locationId, locationId));
      if (!hours.length) return [];
      return tx.insert(locationHours).values(hours.map((h) => ({ ...h, locationId }))).returning();
    });
  }

  // ── Taxes & fees (restaurant-owned) ──
  async setTaxRate(user: AuthUser, locationId: string, taxRatePpm: number) {
    await this.requireLocation(user, locationId, 'owner');
    if (!Number.isInteger(taxRatePpm) || taxRatePpm < 0 || taxRatePpm > 200_000) throw badRequest('invalid_tax_rate', 'Enter a rate between 0% and 20%');
    const [l] = await this.db.update(locations).set({ taxRatePpm }).where(eq(locations.id, locationId)).returning();
    return l;
  }

  /** "I'm responsible for charging, reporting and paying sales tax." Owner only. */
  async acceptTaxResponsibility(user: AuthUser, restaurantId: string) {
    await this.requireMember(user, restaurantId, 'owner');
    await this.payments.acceptTaxResponsibility(restaurantId);
    const [r] = await this.db.update(restaurants).set({ taxResponsibilityAcceptedAt: new Date() }).where(eq(restaurants.id, restaurantId)).returning();
    return r;
  }

  async addFee(user: AuthUser, restaurantId: string, input: FeeInput) {
    await this.requireMember(user, restaurantId, 'owner');
    validateFee(input);
    const [f] = await this.db.insert(restaurantFees).values({ ...input, restaurantId, taxable: input.kind === 'service_charge' ? true : input.taxable ?? true }).returning();
    return f;
  }

  async updateFee(user: AuthUser, feeId: string, input: Partial<FeeInput>) {
    const [f] = await this.db.select().from(restaurantFees).where(eq(restaurantFees.id, feeId));
    if (!f) throw notFound('Fee');
    await this.requireMember(user, f.restaurantId, 'owner');
    const merged = { ...f, ...input } as FeeInput;
    validateFee(merged);
    const [row] = await this.db.update(restaurantFees).set({ ...input, taxable: merged.kind === 'service_charge' ? true : merged.taxable }).where(eq(restaurantFees.id, feeId)).returning();
    return row;
  }

  async removeFee(user: AuthUser, feeId: string) {
    const [f] = await this.db.select().from(restaurantFees).where(eq(restaurantFees.id, feeId));
    if (!f) throw notFound('Fee');
    await this.requireMember(user, f.restaurantId, 'owner');
    await this.db.update(restaurantFees).set({ active: false }).where(eq(restaurantFees.id, feeId));
    return { ok: true };
  }

  // ── Delivery fee (who pays) ──
  async setDeliveryRule(user: AuthUser, restaurantId: string, input: { rule: DeliveryRule; perOrderCapCents?: number | null; monthlyBudgetCents?: number | null }) {
    await this.requireMember(user, restaurantId, 'owner');
    const [u] = await this.db.select().from(users).where(eq(users.id, user.id));
    const consent = await this.payments.setDeliveryConsent(restaurantId, { ...input, acceptedBy: u?.email ?? u?.phone ?? user.id });
    const [r] = await this.db.update(restaurants).set({ deliveryRule: { ...input }, deliveryRuleVersion: consent.version }).where(eq(restaurants.id, restaurantId)).returning();
    return r;
  }

  // ── Team ──
  async team(user: AuthUser, restaurantId: string) {
    await this.requireMember(user, restaurantId);
    return this.db.select({ userId: users.id, name: users.name, phone: users.phone, role: restaurantMembers.role }).from(restaurantMembers)
      .innerJoin(users, eq(users.id, restaurantMembers.userId)).where(eq(restaurantMembers.restaurantId, restaurantId));
  }

  /** Adds a teammate by phone; they sign in with that number as restaurant staff. */
  async addTeammate(user: AuthUser, restaurantId: string, input: { phone: string; name?: string; role: MemberRole }) {
    const myRole = await this.requireMember(user, restaurantId, 'manager');
    if (RANK[input.role] > RANK[myRole]) throw forbidden('You can’t give a higher role than your own');
    const [u] = await this.db.insert(users).values({ phone: input.phone, role: 'restaurant_staff', name: input.name })
      .onConflictDoUpdate({ target: [users.phone, users.role], set: { phone: input.phone } }).returning();
    await this.db.insert(restaurantMembers).values({ restaurantId, userId: u.id, role: input.role })
      .onConflictDoUpdate({ target: [restaurantMembers.restaurantId, restaurantMembers.userId], set: { role: input.role } });
    return { userId: u.id, phone: u.phone, name: u.name, role: input.role };
  }

  async removeTeammate(user: AuthUser, restaurantId: string, userId: string) {
    await this.requireMember(user, restaurantId, 'owner');
    if (userId === user.id) throw conflict('last_owner', 'You can’t remove yourself');
    await this.db.delete(restaurantMembers).where(and(eq(restaurantMembers.restaurantId, restaurantId), eq(restaurantMembers.userId, userId)));
    return { ok: true };
  }

  // ── Stripe payouts & going live ──
  async payoutsLink(user: AuthUser, restaurantId: string) {
    await this.requireMember(user, restaurantId, 'owner');
    return this.payments.restaurantOnboardingLink(restaurantId);
  }

  /** Stripe tab (owner only: it shows bank details, balance and payouts). */
  async stripeOverview(user: AuthUser, restaurantId: string) {
    await this.requireMember(user, restaurantId, 'owner');
    return this.payments.stripeOverview('restaurant', restaurantId);
  }

  async stripeAccountSession(user: AuthUser, restaurantId: string) {
    await this.requireMember(user, restaurantId, 'owner');
    return this.payments.stripeAccountSession('restaurant', restaurantId);
  }

  async goLive(user: AuthUser, restaurantId: string) {
    const full = await this.get(user, restaurantId);
    await this.requireMember(user, restaurantId, 'owner');
    const missing = Object.entries(full.checklist).filter(([, ok]) => !ok).map(([k]) => k);
    if (missing.length) throw conflict('not_ready', `Finish setup first: ${missing.join(', ')}`);
    await this.payments.ensureSubscription(restaurantId);
    const [r] = await this.db.update(restaurants).set({ status: 'live' }).where(eq(restaurants.id, restaurantId)).returning();
    return r;
  }

  private checklist(r: typeof restaurants.$inferSelect, locs: (typeof locations.$inferSelect)[], hoursCount: number) {
    return {
      location: locs.length > 0,
      hours: hoursCount > 0,
      taxResponsibility: !!r.taxResponsibilityAcceptedAt,
      deliveryFeeRule: r.deliveryRuleVersion != null,
      payouts: r.payoutsReady,
    };
  }
}

function validateFee(f: FeeInput) {
  const hasRate = f.rateBps != null && f.rateBps > 0, hasFixed = f.fixedCents != null && f.fixedCents > 0;
  if (!hasRate && !hasFixed) throw badRequest('invalid_fee', 'Set a percentage or a fixed amount');
  if (f.rateBps != null && (!Number.isInteger(f.rateBps) || f.rateBps < 0 || f.rateBps > 3000)) throw badRequest('invalid_fee', 'Percentage must be 0–30%');
  if (f.kind === 'mandatory_gratuity' && !/gratuity/i.test(f.label)) throw badRequest('invalid_fee', 'A mandatory gratuity must be labelled “gratuity”');
  if (f.kind === 'large_order_fee' && f.minFoodCents == null) throw badRequest('invalid_fee', 'A large-order fee needs a minimum order amount');
}
