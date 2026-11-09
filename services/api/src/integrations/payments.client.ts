/**
 * Client for services/payments (internal API, shared key). The core API never talks to Stripe
 * directly: food money is charged on the restaurant's own account by the payments service.
 */
import type { PaymentsAllocation } from '../core/receipt';

export type DeliveryRule =
  | { kind: 'customer_pays' } | { kind: 'restaurant_pays' }
  | { kind: 'split_fixed'; restaurantCents: number } | { kind: 'split_percent'; restaurantBps: number }
  | { kind: 'free_above'; minFoodCents: number; belowRestaurantCents?: number };

export interface PaymentsQuoteRequest {
  restaurantId: string; foodCents: number; serviceChargeCents: number; taxCents: number; tipCents: number;
  taxBreakdown?: { label: string; rateBps: number; amountCents: number }[];
  delivery: { provider: 'pickup' } | { provider: 'uber_direct' | 'doordash_drive' | 'own_driver'; providerQuoteId?: string; deliveryCents: number; expiresAt: string };
}
export interface PaymentsQuote { quoteId: string; expiresAt: string; allocation: PaymentsAllocation & Record<string, number>; stripeAccount?: string | null }
export interface PaymentsPayment { orderId: string; paymentIntentId: string; clientSecret: string; stripeAccount: string; totalCents: number }

export type StripeAccountSession = { clientSecret: string; expiresAt: number; stripeAccountId: string } | { clientSecret: null; reason: 'no_account' };
export interface StripeOverview {
  kind: 'restaurant' | 'driver';
  stripeAccountId: string | null;
  displayName?: string | null;
  setup: 'not_started' | 'pending' | 'restricted' | 'active';
  ready: boolean;
  requirementsDue: string[];
  payoutSchedule: string | null;
  bank: { name: string | null; last4: string } | null;
  balance: { availableCents: number; pendingCents: number } | null;
  payouts: { id: string; amountCents: number; status: string; arrivalDate: string; method: string; failureMessage: string | null }[];
  statement?: { weekStart: string; trips: number; payCents: number; tipCents: number; topUpCents: number; totalCents: number }[];
  error: string | null;
}

export interface PaymentsClient {
  upsertRestaurant(r: { id: string; name: string; contactEmail: string }): Promise<unknown>;
  upsertDriver(d: { id: string; name: string; contactEmail: string }): Promise<unknown>;
  acceptTaxResponsibility(restaurantId: string): Promise<unknown>;
  setDeliveryConsent(restaurantId: string, c: { rule: DeliveryRule; perOrderCapCents?: number | null; monthlyBudgetCents?: number | null; acceptedBy: string }): Promise<{ version: number }>;
  restaurantStatus(restaurantId: string): Promise<{ ready: boolean; onboardingStatus: string }>;
  driverStatus(driverId: string): Promise<{ ready: boolean; onboardingStatus: string }>;
  restaurantOnboardingLink(restaurantId: string): Promise<{ url: string }>;
  driverOnboardingLink(driverId: string): Promise<{ url: string }>;
  /** Stripe tab: client secret for Connect embedded components (null when there's no Stripe account yet). */
  stripeAccountSession(kind: 'restaurant' | 'driver', id: string): Promise<StripeAccountSession>;
  /** Stripe tab: setup state, what Stripe needs, payout schedule, bank, balance, payouts, driver statements. */
  stripeOverview(kind: 'restaurant' | 'driver', id: string): Promise<StripeOverview>;
  ensureSubscription(restaurantId: string): Promise<unknown>;
  quote(req: PaymentsQuoteRequest): Promise<PaymentsQuote>;
  createPayment(quoteId: string): Promise<PaymentsPayment>;
  paymentStatus(paymentsOrderId: string): Promise<{ authorized: boolean; paymentIntentStatus: string }>;
  accept(paymentsOrderId: string): Promise<unknown>;
  decline(paymentsOrderId: string, reason: 'restaurant_declined' | 'auto_declined' | 'customer_cancelled'): Promise<unknown>;
  refund(paymentsOrderId: string, body: { requestId: string; reason: string; foodCents?: number; serviceChargeCents?: number; taxCents?: number; customerDeliveryCents?: number; restoreSubsidyCents?: number; tipCents?: number }): Promise<unknown>;
  ownDriverDelivered(paymentsOrderId: string, driverId: string, driverPayCents: number): Promise<unknown>;
  supplierAssigned(paymentsOrderId: string, provider: 'uber_direct' | 'doordash_drive', providerDeliveryId: string): Promise<unknown>;
  supplierTipSubmitted(paymentsOrderId: string): Promise<unknown>;
  nycWeeklyTopUp(driverId: string, body: { weekStart: string; tripSeconds: number; paidCents: number }): Promise<{ amountCents: number; status: string }>;
  /** Admin console reads (money lives in the payments service). */
  admin<T = unknown>(path: string, query?: Record<string, string | undefined>): Promise<T>;
  adminPost<T = unknown>(path: string, body?: unknown): Promise<T>;
  health(): Promise<boolean>;
}

export class PaymentsError extends Error {
  constructor(public readonly status: number, public readonly body: unknown) {
    super(`Payments service ${status}: ${typeof body === 'object' && body && 'message' in body ? String((body as { message: unknown }).message) : JSON.stringify(body)}`);
  }
  get code(): string | undefined { return typeof this.body === 'object' && this.body && 'code' in this.body ? String((this.body as { code: unknown }).code) : undefined; }
}

export class HttpPaymentsClient implements PaymentsClient {
  constructor(private readonly baseUrl: string, private readonly key: string, private readonly fetchImpl: typeof fetch = fetch) {}

  private async call<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(new URL(path, this.baseUrl), {
      method, headers: { 'content-type': 'application/json', 'x-internal-key': this.key },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : undefined;
    if (!res.ok) throw new PaymentsError(res.status, json);
    return json as T;
  }

  upsertRestaurant(r: { id: string; name: string; contactEmail: string }) { return this.call('POST', '/registry/restaurants', r); }
  upsertDriver(d: { id: string; name: string; contactEmail: string }) { return this.call('POST', '/registry/drivers', d); }
  acceptTaxResponsibility(id: string) { return this.call('POST', `/restaurants/${id}/tax-responsibility`); }
  setDeliveryConsent(id: string, c: Parameters<PaymentsClient['setDeliveryConsent']>[1]) { return this.call<{ version: number }>('POST', `/restaurants/${id}/delivery-consents`, c); }
  restaurantStatus(id: string) { return this.call<{ ready: boolean; onboardingStatus: string }>('GET', `/restaurants/${id}/status`); }
  driverStatus(id: string) { return this.call<{ ready: boolean; onboardingStatus: string }>('GET', `/drivers/${id}/status`); }
  restaurantOnboardingLink(id: string) { return this.call<{ url: string }>('POST', `/restaurants/${id}/stripe/onboarding-link`); }
  driverOnboardingLink(id: string) { return this.call<{ url: string }>('POST', `/drivers/${id}/stripe/onboarding-link`); }
  stripeAccountSession(kind: 'restaurant' | 'driver', id: string) { return this.call<StripeAccountSession>('POST', `/${kind}s/${id}/stripe/account-session`); }
  stripeOverview(kind: 'restaurant' | 'driver', id: string) { return this.call<StripeOverview>('GET', `/${kind}s/${id}/stripe/overview`); }
  ensureSubscription(id: string) { return this.call('POST', `/restaurants/${id}/subscription`); }
  quote(req: PaymentsQuoteRequest) { return this.call<PaymentsQuote>('POST', '/checkout/quotes', req); }
  createPayment(quoteId: string) { return this.call<PaymentsPayment>('POST', `/checkout/quotes/${quoteId}/payment`); }
  paymentStatus(id: string) { return this.call<{ authorized: boolean; paymentIntentStatus: string }>('GET', `/orders/${id}/payment-status`); }
  accept(id: string) { return this.call('POST', `/orders/${id}/accept`); }
  decline(id: string, reason: 'restaurant_declined' | 'auto_declined' | 'customer_cancelled') { return this.call('POST', `/orders/${id}/decline`, { reason }); }
  refund(id: string, body: Parameters<PaymentsClient['refund']>[1]) { return this.call('POST', `/orders/${id}/refunds`, body); }
  ownDriverDelivered(id: string, driverId: string, driverPayCents: number) { return this.call('POST', `/fulfilment/${id}/own-driver-delivered`, { driverId, driverPayCents }); }
  supplierAssigned(id: string, provider: 'uber_direct' | 'doordash_drive', providerDeliveryId: string) { return this.call('POST', `/fulfilment/${id}/supplier-assigned`, { provider, providerDeliveryId }); }
  supplierTipSubmitted(id: string) { return this.call('POST', `/fulfilment/${id}/supplier-tip-submitted`); }
  admin<T = unknown>(path: string, query: Record<string, string | undefined> = {}) {
    const qs = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => e[1] !== undefined)).toString();
    return this.call<T>('GET', `/admin/${path}${qs ? `?${qs}` : ''}`);
  }
  adminPost<T = unknown>(path: string, body?: unknown) { return this.call<T>('POST', `/admin/${path}`, body); }
  async health() { try { const r = await this.fetchImpl(new URL('/health', this.baseUrl), { signal: AbortSignal.timeout(3000) }); return r.ok; } catch { return false; } }
  nycWeeklyTopUp(driverId: string, body: { weekStart: string; tripSeconds: number; paidCents: number }) { return this.call<{ amountCents: number; status: string }>('POST', `/drivers/${driverId}/nyc-top-ups`, body); }
}
