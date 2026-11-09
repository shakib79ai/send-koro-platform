/**
 * Recording fake of the Stripe surface used by the services. Mimics Stripe's idempotency (same
 * key → same object, no second side effect) so duplicate-event tests are meaningful. Webhook
 * signing uses the REAL stripe-node webhook utilities.
 */
import Stripe from 'stripe';

export interface Call { method: string; params: any; opts: any }

export function createFakeStripe(init: { availableBalance?: number; stripeFeeCents?: number; cardCountry?: string } = {}) {
  const real = new Stripe('sk_test_fake', { apiVersion: '2026-08-26.dahlia' });
  const calls: Call[] = [];
  const idem = new Map<string, any>();
  let seq = 0;
  const state = { availableBalance: init.availableBalance ?? 1_000_000, stripeFeeCents: init.stripeFeeCents ?? 0, cardCountry: init.cardCountry ?? 'US' };
  const pis = new Map<string, any>();

  function op<T>(method: string, params: any, opts: any, make: () => T): T {
    calls.push({ method, params, opts });
    const k = opts?.idempotencyKey ? `${method}|${opts.idempotencyKey}` : null;
    if (k && idem.has(k)) return idem.get(k);
    const v = make();
    if (k) idem.set(k, v);
    return v;
  }
  const id = (p: string) => `${p}_${++seq}`;

  const fake = {
    webhooks: real.webhooks,
    parseEventNotification: real.parseEventNotification.bind(real),
    v2: {
      core: {
        accounts: {
          create: async (params: any, opts?: any) => op('v2.accounts.create', params, opts, () => ({ id: id('acct'), ...params })),
          retrieve: async (acct: string, params?: any) => op('v2.accounts.retrieve', { acct, ...params }, undefined, () => ({
            id: acct, metadata: { send_koro_type: acct.includes('drv') ? 'driver' : 'restaurant' },
            configuration: { merchant: { capabilities: { card_payments: { status: 'active' } } }, recipient: { capabilities: { stripe_balance: { stripe_transfers: { status: 'active' } } } } },
            requirements: { entries: [] },
          })),
        },
        accountLinks: { create: async (params: any) => op('v2.accountLinks.create', params, undefined, () => ({ url: `https://connect.stripe.test/${params.account}` })) },
      },
    },
    paymentIntents: {
      create: async (params: any, opts: any) => op('paymentIntents.create', params, opts, () => {
        const pi = { id: id('pi'), object: 'payment_intent', client_secret: 'secret', status: 'requires_payment_method', created: Math.floor(Date.now() / 1000), latest_charge: null as string | null, ...params };
        pis.set(pi.id, pi);
        return pi;
      }),
      retrieve: async (piId: string, params: any, opts: any) => op('paymentIntents.retrieve', { piId, ...params }, opts, () => ({
        ...pis.get(piId), status: 'requires_capture',
        latest_charge: { id: `ch_for_${piId}`, payment_method_details: { card: { country: state.cardCountry } } },
      })),
      capture: async (piId: string, params: any, opts: any) => op('paymentIntents.capture', { piId, ...params }, opts, () => {
        const pi = pis.get(piId); pi.status = 'succeeded'; pi.latest_charge = `ch_for_${piId}`;
        if (params?.application_fee_amount !== undefined) pi.application_fee_amount = params.application_fee_amount;
        return pi;
      }),
      cancel: async (piId: string, params: any, opts: any) => op('paymentIntents.cancel', { piId, ...params }, opts, () => ({ ...pis.get(piId), status: 'canceled' })),
    },
    charges: {
      retrieve: async (chId: string, params: any, opts: any) => op('charges.retrieve', { chId, ...params }, opts, () => ({
        id: chId, application_fee: `fee_for_${chId}`,
        balance_transaction: { fee_details: [{ type: 'stripe_fee', amount: state.stripeFeeCents }, { type: 'application_fee', amount: 999 }] },
      })),
    },
    refunds: { create: async (params: any, opts: any) => op('refunds.create', params, opts, () => ({ id: id('re'), ...params })) },
    applicationFees: { createRefund: async (feeId: string, params: any, opts: any) => op('applicationFees.createRefund', { feeId, ...params }, opts, () => ({ id: id('fr'), fee: feeId, ...params })) },
    balance: { retrieve: async (_p?: any, opts?: any) => op('balance.retrieve', {}, opts, () => ({ available: [{ currency: 'usd', amount: state.availableBalance }], pending: [{ currency: 'usd', amount: 0 }] })) },
    payouts: { list: async (params: any, opts: any) => op('payouts.list', params, opts, () => ({ data: [{ id: 'po_1', amount: 12345, status: 'paid', arrival_date: 1_790_000_000, method: 'standard', failure_message: null }] })) },
    accountSessions: { create: async (params: any) => op('accountSessions.create', params, undefined, () => ({ object: 'account_session', account: params.account, client_secret: `${params.account}_secret_${++seq}`, expires_at: 1_790_001_800, components: params.components })) },
    accounts: {
      retrieve: async (acct: string) => op('accounts.retrieve', { acct }, undefined, () => ({
        id: acct, settings: { payouts: { schedule: { interval: 'weekly', weekly_anchor: 'monday', delay_days: 2 } } },
        external_accounts: { data: [{ object: 'bank_account', bank_name: 'CHASE', last4: '4410' }] },
      })),
    },
    transfers: { create: async (params: any, opts: any) => op('transfers.create', params, opts, () => ({ id: id('tr'), ...params })) },
    prices: { list: async (params: any) => op('prices.list', params, undefined, () => ({ data: [{ id: `price_${params.lookup_keys[0]}` }] })) },
    subscriptions: {
      create: async (params: any, opts: any) => op('subscriptions.create', params, opts, () => ({ ...params, id: id('sub'), status: 'trialing', items: { data: [{ id: id('si') }] } })),
      update: async (subId: string, params: any, opts: any) => op('subscriptions.update', { subId, ...params }, opts, () => ({ id: subId, ...params })),
    },
    invoices: { update: async (invId: string, params: any) => op('invoices.update', { invId, ...params }, undefined, () => ({ id: invId, ...params })) },
    paymentMethodDomains: {
      list: async (params: any, opts: any) => op('paymentMethodDomains.list', params, opts, () => ({ data: [] })),
      create: async (params: any, opts: any) => op('paymentMethodDomains.create', params, opts, () => ({ id: id('pmd'), ...params })),
    },
    checkout: { sessions: { create: async (params: any) => op('checkout.sessions.create', params, undefined, () => ({ id: id('cs'), url: 'https://checkout.stripe.test/setup' })) } },
  };

  return {
    stripe: fake as unknown as Stripe,
    calls,
    state,
    callsTo: (m: string) => calls.filter((c) => c.method === m),
    /** Distinct side effects (idempotent replays collapse to one). */
    effects: (m: string) => new Set(calls.filter((c) => c.method === m).map((c) => c.opts?.idempotencyKey ?? Math.random())).size,
  };
}

/** Build a signed webhook request body exactly as Stripe would send it. */
export function signedEvent(secret: string, event: Record<string, unknown>) {
  const real = new Stripe('sk_test_fake', { apiVersion: '2026-08-26.dahlia' });
  const payload = JSON.stringify({ object: 'event', api_version: '2026-08-26.dahlia', livemode: false, created: Math.floor(Date.now() / 1000), ...event });
  const header = real.webhooks.generateTestHeaderString({ payload, secret });
  return { payload, header };
}
