/**
 * In-memory stand-in for services/payments. Mirrors its delivery split (customer pays C = D − R)
 * and records every call so tests can assert the money hand-offs (capture, driver pay, tips).
 */
import { randomUUID } from 'node:crypto';
import type { DeliveryRule, PaymentsClient, PaymentsQuoteRequest } from '../src/integrations/payments.client';
import { PaymentsError } from '../src/integrations/payments.client';

function restaurantShare(rule: DeliveryRule, D: number, F: number, cap?: number | null) {
  let R = 0;
  switch (rule.kind) {
    case 'customer_pays': R = 0; break;
    case 'restaurant_pays': R = D; break;
    case 'split_fixed': R = Math.min(D, rule.restaurantCents); break;
    case 'split_percent': R = Math.floor((D * rule.restaurantBps) / 10000); break;
    case 'free_above': R = F >= rule.minFoodCents ? D : Math.min(D, rule.belowRestaurantCents ?? 0); break;
  }
  return cap != null ? Math.min(R, cap) : R;
}

export function createFakePayments() {
  const calls: { method: string; args: unknown[] }[] = [];
  const restaurants = new Map<string, { tax: boolean; ready: boolean; consent?: { rule: DeliveryRule; cap?: number | null; version: number } }>();
  const drivers = new Map<string, { ready: boolean }>();
  const quotes = new Map<string, { req: PaymentsQuoteRequest; allocation: Record<string, number> }>();
  const orders = new Map<string, { quoteId: string; status: 'awaiting_payment' | 'authorized' | 'paid' | 'declined' }>();
  const byQuote = new Map<string, string>();
  const rec = (method: string, ...args: unknown[]) => calls.push({ method, args });

  const client: PaymentsClient = {
    async upsertRestaurant(r) { rec('upsertRestaurant', r); if (!restaurants.has(r.id)) restaurants.set(r.id, { tax: false, ready: false }); return r; },
    async upsertDriver(d) { rec('upsertDriver', d); if (!drivers.has(d.id)) drivers.set(d.id, { ready: false }); return d; },
    async acceptTaxResponsibility(id) { rec('acceptTaxResponsibility', id); restaurants.get(id)!.tax = true; return {}; },
    async setDeliveryConsent(id, c) {
      rec('setDeliveryConsent', id, c);
      const r = restaurants.get(id)!;
      r.consent = { rule: c.rule, cap: c.perOrderCapCents, version: (r.consent?.version ?? 0) + 1 };
      return { version: r.consent.version };
    },
    async restaurantStatus(id) { return { ready: restaurants.get(id)?.ready ?? false, onboardingStatus: 'active' }; },
    async driverStatus(id) { return { ready: drivers.get(id)?.ready ?? false, onboardingStatus: 'active' }; },
    async restaurantOnboardingLink(id) { return { url: `https://connect.stripe.test/r/${id}` }; },
    async driverOnboardingLink(id) { return { url: `https://connect.stripe.test/d/${id}` }; },
    async stripeAccountSession(kind, id) { rec('stripeAccountSession', kind, id); return { clientSecret: `accs_${kind}_${id.slice(0, 8)}_secret`, expiresAt: 1_790_001_800, stripeAccountId: `acct_${kind}` }; },
    async stripeOverview(kind, id) {
      rec('stripeOverview', kind, id);
      return {
        kind, stripeAccountId: `acct_${kind}`, setup: 'active', ready: true, requirementsDue: [], payoutSchedule: 'Every day (2 days to arrive)',
        bank: { name: 'CHASE', last4: '4410' }, balance: { availableCents: 4120, pendingCents: 1300 }, payouts: [],
        ...(kind === 'driver' ? { statement: [{ weekStart: '2026-11-02', trips: 1, payCents: 780, tipCents: 540, topUpCents: 0, totalCents: 1320 }] } : {}), error: null,
      };
    },
    async ensureSubscription(id) { rec('ensureSubscription', id); return {}; },
    async quote(req) {
      rec('quote', req);
      const r = restaurants.get(req.restaurantId);
      if (!r?.tax || !r.consent) throw new PaymentsError(400, { code: 'rule_not_authorized', message: 'not ready' });
      const D = req.delivery.provider === 'pickup' ? 0 : req.delivery.deliveryCents;
      const R = restaurantShare(r.consent.rule, D, req.foodCents, r.consent.cap);
      const C = D - R, T = req.tipCents;
      const allocation = { F: req.foodCents, S: req.serviceChargeCents, X: req.taxCents, D, R, C, T, Q: req.foodCents + req.serviceChargeCents + req.taxCents + C + T, A: D + T };
      const quoteId = randomUUID();
      quotes.set(quoteId, { req, allocation });
      return { quoteId, expiresAt: new Date(Date.now() + 600_000).toISOString(), allocation, stripeAccount: 'acct_rest' };
    },
    async createPayment(quoteId) {
      rec('createPayment', quoteId);
      let orderId = byQuote.get(quoteId);
      if (!orderId) { orderId = randomUUID(); byQuote.set(quoteId, orderId); orders.set(orderId, { quoteId, status: 'awaiting_payment' }); }
      return { orderId, paymentIntentId: `pi_${orderId.slice(0, 8)}`, clientSecret: `pi_${orderId.slice(0, 8)}_secret`, stripeAccount: 'acct_rest', totalCents: quotes.get(quoteId)!.allocation.Q };
    },
    async paymentStatus(id) { const o = orders.get(id)!; return { authorized: o.status !== 'awaiting_payment', paymentIntentStatus: o.status === 'awaiting_payment' ? 'requires_payment_method' : 'requires_capture' }; },
    async accept(id) { rec('accept', id); const o = orders.get(id)!; if (o.status !== 'authorized' && o.status !== 'paid') throw new PaymentsError(400, { code: 'not_authorized' }); o.status = 'paid'; return {}; },
    async decline(id, reason) { rec('decline', id, reason); orders.get(id)!.status = 'declined'; return {}; },
    async refund(id, body) { rec('refund', id, body); return { ok: true }; },
    async ownDriverDelivered(id, driverId, pay) { rec('ownDriverDelivered', id, driverId, pay); return {}; },
    async supplierAssigned(id, provider, did) { rec('supplierAssigned', id, provider, did); return {}; },
    async supplierTipSubmitted(id) { rec('supplierTipSubmitted', id); return {}; },
    async nycWeeklyTopUp(driverId, body) { rec('nycWeeklyTopUp', driverId, body); return { amountCents: 0, status: 'paid' }; },
    async admin<T>(path: string, query?: Record<string, string | undefined>) { rec('admin', path, query); return { path } as T; },
    async adminPost<T>(path: string, body?: unknown) { rec('adminPost', path, body); return { ok: true } as T; },
    async health() { return true; },
  };

  return {
    client, calls, restaurants, drivers, orders,
    callsTo: (m: string) => calls.filter((c) => c.method === m),
    /** Simulates the customer's card being authorised by Stripe.js. */
    authorize: (paymentsOrderId: string) => { orders.get(paymentsOrderId)!.status = 'authorized'; },
  };
}
