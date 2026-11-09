/**
 * Registry — the core API (services/api) mirrors its restaurants and drivers here so the
 * payments service can own Stripe accounts, tax acceptance and delivery-fee consents.
 * Everything is idempotent on the caller's IDs.
 */
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { deliveryConsents, drivers, restaurants } from '../db/schema';
import { AllocationError, DeliveryRule } from '../core/allocation';

export interface ConsentInput {
  rule: DeliveryRule;
  perOrderCapCents?: number | null;
  monthlyBudgetCents?: number | null;
  acceptedBy: string;
}

export function validateRule(rule: DeliveryRule): void {
  const nonNegInt = (n: unknown) => Number.isInteger(n) && (n as number) >= 0;
  switch (rule.kind) {
    case 'customer_pays':
    case 'restaurant_pays':
      return;
    case 'split_fixed':
      if (!nonNegInt(rule.restaurantCents)) throw new AllocationError('invalid_rule', 'restaurantCents must be whole cents ≥ 0');
      return;
    case 'split_percent':
      if (!Number.isInteger(rule.restaurantBps) || rule.restaurantBps < 0 || rule.restaurantBps > 10000) throw new AllocationError('invalid_rule', 'restaurantBps must be 0–10000');
      return;
    case 'free_above':
      if (!nonNegInt(rule.minFoodCents) || (rule.belowRestaurantCents !== undefined && !nonNegInt(rule.belowRestaurantCents))) throw new AllocationError('invalid_rule', 'amounts must be whole cents ≥ 0');
      return;
    default:
      throw new AllocationError('invalid_rule', 'Unknown delivery rule');
  }
}

export class RegistryService {
  constructor(private readonly db: Db, private readonly now: () => Date = () => new Date()) {}

  /** Creates or renames a restaurant using the core API's ID as ours. */
  async upsertRestaurant(input: { id: string; name: string; contactEmail: string }) {
    const [row] = await this.db.insert(restaurants).values(input)
      .onConflictDoUpdate({ target: restaurants.id, set: { name: input.name, contactEmail: input.contactEmail } }).returning();
    return row;
  }

  async upsertDriver(input: { id: string; name: string; contactEmail: string }) {
    const [row] = await this.db.insert(drivers).values(input)
      .onConflictDoUpdate({ target: drivers.id, set: { name: input.name, contactEmail: input.contactEmail } }).returning();
    return row;
  }

  /** Read-only status for the core API: can this party be paid / take card payments yet? */
  async restaurantStatus(id: string) {
    const [r] = await this.db.select().from(restaurants).where(eq(restaurants.id, id));
    if (!r) throw new Error('Restaurant not found');
    return { id: r.id, onboardingStatus: r.onboardingStatus, ready: r.onboardingStatus === 'active' && r.cardPaymentsActive, taxResponsibilityAccepted: !!r.taxResponsibilityAcceptedAt };
  }

  async driverStatus(id: string) {
    const [d] = await this.db.select().from(drivers).where(eq(drivers.id, id));
    if (!d) throw new Error('Driver not found');
    return { id: d.id, onboardingStatus: d.onboardingStatus, ready: d.onboardingStatus === 'active' && d.transfersActive };
  }

  /** "I'm responsible for charging, reporting and paying sales tax." First acceptance time is kept. */
  async acceptTaxResponsibility(restaurantId: string) {
    const [row] = await this.db.update(restaurants).set({ taxResponsibilityAcceptedAt: this.now() })
      .where(and(eq(restaurants.id, restaurantId), isNull(restaurants.taxResponsibilityAcceptedAt))).returning();
    if (row) return row;
    const [existing] = await this.db.select().from(restaurants).where(eq(restaurants.id, restaurantId));
    if (!existing) throw new Error('Restaurant not found');
    return existing;
  }

  /** New versioned consent; the previous one ends at the same instant. Identical re-submits are no-ops. */
  async setDeliveryConsent(restaurantId: string, input: ConsentInput) {
    validateRule(input.rule);
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${'consent:' + restaurantId}))`);
      const [current] = await tx.select().from(deliveryConsents)
        .where(and(eq(deliveryConsents.restaurantId, restaurantId), isNull(deliveryConsents.validTo)))
        .orderBy(desc(deliveryConsents.version)).limit(1);
      const same = current
        && JSON.stringify(current.rule) === JSON.stringify(input.rule)
        && (current.perOrderCapCents ?? null) === (input.perOrderCapCents ?? null)
        && (current.monthlyBudgetCents ?? null) === (input.monthlyBudgetCents ?? null);
      if (same) return current;
      const at = this.now();
      if (current) await tx.update(deliveryConsents).set({ validTo: at }).where(eq(deliveryConsents.id, current.id));
      const [row] = await tx.insert(deliveryConsents).values({
        restaurantId, version: (current?.version ?? 0) + 1, rule: input.rule,
        perOrderCapCents: input.perOrderCapCents ?? null, monthlyBudgetCents: input.monthlyBudgetCents ?? null,
        acceptedBy: input.acceptedBy, validFrom: at, acceptedAt: at,
      }).returning();
      return row;
    });
  }
}
