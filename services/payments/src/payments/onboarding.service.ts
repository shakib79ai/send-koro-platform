/**
 * Connected-account onboarding (Accounts v2 + Stripe-hosted onboarding) — brief §"Stripe configuration".
 *
 * Restaurants: merchant configuration (card payments → direct charges), full Stripe Dashboard,
 *   defaults.responsibilities.fees_collector = 'stripe' and losses_collector = 'stripe'
 *   (restaurant pays its processing fees; Stripe owns unrecoverable connected-account losses),
 *   plus a customer configuration so Send Koro can bill the restaurant's subscription with
 *   `customer_account` instead of a separate Customer object.
 * Drivers (own network): connected accounts set up like restaurants — full Stripe Dashboard,
 *   fees_collector = 'stripe', losses_collector = 'stripe' — with the recipient configuration
 *   (stripe_balance.stripe_transfers) because they receive weekly platform transfers rather than
 *   taking card payments. Confirm with Stripe that recipient accounts may use Stripe-collected fees
 *   (brief review Q3); if not, switch to fees_collector 'application' and book payout costs as delivery costs.
 */
import type Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { drivers, restaurants } from '../db/schema';

export interface OnboardingUrls { restaurantPortalUrl: string; driverAppUrl: string; paymentMethodDomain: string }

export class OnboardingService {
  constructor(private readonly stripe: Stripe, private readonly db: Db, private readonly urls: OnboardingUrls) {}

  async createRestaurantAccount(restaurantId: string): Promise<string> {
    const [r] = await this.db.select().from(restaurants).where(eq(restaurants.id, restaurantId));
    if (!r) throw new Error('Restaurant not found');
    if (r.stripeAccountId) return r.stripeAccountId;

    const account = await this.stripe.v2.core.accounts.create(
      {
        display_name: r.name,
        contact_email: r.contactEmail,
        dashboard: 'full',
        identity: { country: 'us' },
        defaults: {
          currency: 'usd',
          locales: ['en-US'],
          profile: { product_description: 'Restaurant selling prepared food for delivery and pickup through Send Koro' },
          responsibilities: { fees_collector: 'stripe', losses_collector: 'stripe' },
        },
        configuration: {
          merchant: { capabilities: { card_payments: { requested: true } } },
          customer: {},
        },
        include: ['configuration.merchant', 'requirements'],
        metadata: { send_koro_type: 'restaurant', send_koro_restaurant_id: r.id },
      },
      { idempotencyKey: `restaurant-account:${r.id}` },
    );
    await this.db.update(restaurants).set({ stripeAccountId: account.id, onboardingStatus: 'pending' }).where(eq(restaurants.id, r.id));
    return account.id;
  }

  async restaurantOnboardingLink(restaurantId: string): Promise<string> {
    const accountId = await this.createRestaurantAccount(restaurantId);
    const link = await this.stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          configurations: ['merchant', 'customer'],
          refresh_url: `${this.urls.restaurantPortalUrl}/payouts/stripe/refresh`,
          return_url: `${this.urls.restaurantPortalUrl}/payouts/stripe/return`,
        },
      },
    });
    return link.url;
  }

  async createDriverAccount(driverId: string): Promise<string> {
    const [d] = await this.db.select().from(drivers).where(eq(drivers.id, driverId));
    if (!d) throw new Error('Driver not found');
    if (d.stripeAccountId) return d.stripeAccountId;
    const account = await this.stripe.v2.core.accounts.create(
      {
        display_name: d.name,
        contact_email: d.contactEmail,
        dashboard: 'full',
        identity: { country: 'us', entity_type: 'individual' },
        defaults: { currency: 'usd', locales: ['en-US'], responsibilities: { fees_collector: 'stripe', losses_collector: 'stripe' } },
        configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
        include: ['configuration.recipient', 'requirements'],
        metadata: { send_koro_type: 'driver', send_koro_driver_id: d.id },
      },
      { idempotencyKey: `driver-account:${d.id}` },
    );
    await this.db.update(drivers).set({ stripeAccountId: account.id, onboardingStatus: 'pending' }).where(eq(drivers.id, d.id));
    return account.id;
  }

  async driverOnboardingLink(driverId: string): Promise<string> {
    const accountId = await this.createDriverAccount(driverId);
    const link = await this.stripe.v2.core.accountLinks.create({
      account: accountId,
      use_case: {
        type: 'account_onboarding',
        account_onboarding: {
          configurations: ['recipient'],
          refresh_url: `${this.urls.driverAppUrl}/payouts/stripe/refresh`,
          return_url: `${this.urls.driverAppUrl}/payouts/stripe/return`,
        },
      },
    });
    return link.url;
  }

  /** Pull current capability status (call on return_url and on v2 account thin events). */
  async syncAccount(accountId: string): Promise<{ type: 'restaurant' | 'driver' | 'unknown'; active: boolean }> {
    const acct = await this.stripe.v2.core.accounts.retrieve(accountId, { include: ['configuration.merchant', 'configuration.recipient', 'requirements'] });
    const type = (acct.metadata?.send_koro_type as 'restaurant' | 'driver' | undefined) ?? 'unknown';
    const hasDue = (acct.requirements?.entries ?? []).some((e) => e.minimum_deadline?.status === 'currently_due' || e.minimum_deadline?.status === 'past_due');
    if (type === 'restaurant') {
      const active = acct.configuration?.merchant?.capabilities?.card_payments?.status === 'active';
      await this.db.update(restaurants)
        .set({ cardPaymentsActive: active, onboardingStatus: active ? 'active' : hasDue ? 'restricted' : 'pending' })
        .where(eq(restaurants.stripeAccountId, accountId));
      if (active) await this.ensurePaymentMethodDomain(accountId);
      return { type, active };
    }
    if (type === 'driver') {
      const active = acct.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status === 'active';
      await this.db.update(drivers)
        .set({ transfersActive: active, onboardingStatus: active ? 'active' : hasDue ? 'restricted' : 'pending' })
        .where(eq(drivers.stripeAccountId, accountId));
      return { type, active };
    }
    return { type, active: false };
  }

  /** Direct charges + Apple Pay/Google Pay need the domain registered on each connected account. */
  async ensurePaymentMethodDomain(accountId: string): Promise<void> {
    const existing = await this.stripe.paymentMethodDomains.list({ domain_name: this.urls.paymentMethodDomain, limit: 1 }, { stripeAccount: accountId });
    if (existing.data.length) return;
    await this.stripe.paymentMethodDomains.create({ domain_name: this.urls.paymentMethodDomain, enabled: true }, { stripeAccount: accountId, idempotencyKey: `pmd:${accountId}` });
  }
}
