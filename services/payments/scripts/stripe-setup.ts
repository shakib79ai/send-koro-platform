/**
 * Send Koro — Stripe sandbox setup (idempotent; safe to re-run).
 *
 *   npm run stripe:setup                         # products, prices, webhooks, billing portal
 *   npm run stripe:setup -- --with-test-accounts # + a test restaurant and a test driver with onboarding links
 *
 * Needs STRIPE_SECRET_KEY (sk_test_…) and PUBLIC_BASE_URL in .env. Refuses live keys unless --live.
 * Prints the webhook signing secrets the first time each endpoint is created — copy them into .env.
 */
import 'dotenv/config';
import { createStripe } from '../src/stripe/stripe.client';
import { RESTAURANT_TIERS, Tier } from '../src/core/tiers';
import { CONNECT_EVENTS, PLATFORM_EVENTS, THIN_EVENTS } from '../src/webhooks/webhooks.service';

const args = new Set(process.argv.slice(2));
const key = process.env.STRIPE_SECRET_KEY ?? '';
const base = (process.env.PUBLIC_BASE_URL ?? '').replace(/\/$/, '');
const expectedPlatform = process.env.STRIPE_PLATFORM_ACCOUNT_ID;

if (!key) throw new Error('Set STRIPE_SECRET_KEY in .env');
if (key.includes('_live_') && !args.has('--live')) throw new Error('Live key detected. Run against a sandbox (sk_test_…), or pass --live deliberately.');
if (!/^https:\/\//.test(base)) throw new Error('PUBLIC_BASE_URL must be a public https URL (use your tunnel URL while developing)');

const stripe = createStripe(key);
const step = (s: string) => console.log(`\n▸ ${s}`);

async function ensureProduct(id: string, name: string, description: string, active = true) {
  try {
    const p = await stripe.products.retrieve(id);
    if (p.active !== active || p.name !== name) await stripe.products.update(id, { active, name, description });
    console.log(`  product ${id} ✓`);
    return id;
  } catch (e: any) {
    if (e?.code !== 'resource_missing') throw e;
    await stripe.products.create({ id, name, description, active, tax_code: 'txcd_10103001' /* SaaS – business use */, metadata: { send_koro: 'true' } });
    console.log(`  product ${id} created`);
    return id;
  }
}

async function ensurePrices(productId: string, tiers: Tier[], active: boolean) {
  for (const t of tiers) {
    const found = await stripe.prices.list({ lookup_keys: [t.lookupKey], limit: 1 });
    const p = found.data[0];
    if (p && p.unit_amount === t.priceCents && p.product === productId) {
      if (p.active !== active) await stripe.prices.update(p.id, { active });
      console.log(`  ${t.lookupKey.padEnd(24)} $${(t.priceCents / 100).toFixed(2)}/mo  ${t.label}  ✓`);
      continue;
    }
    // Prices are immutable: create a new one and move the lookup key to it.
    const np = await stripe.prices.create({
      product: productId, currency: 'usd', unit_amount: t.priceCents, recurring: { interval: 'month' },
      lookup_key: t.lookupKey, transfer_lookup_key: true, active, nickname: t.label,
      tax_behavior: 'exclusive', metadata: { tier_up_to_cents: String(t.upToCents ?? 'unbounded') },
    });
    console.log(`  ${t.lookupKey.padEnd(24)} $${(t.priceCents / 100).toFixed(2)}/mo  ${t.label}  created (${np.id})`);
  }
}

async function ensureWebhook(url: string, events: readonly string[], connect: boolean, label: string) {
  const all = await stripe.webhookEndpoints.list({ limit: 100 });
  const existing = all.data.find((w) => w.url === url);
  if (existing) {
    await stripe.webhookEndpoints.update(existing.id, { enabled_events: [...events] as any, description: label });
    console.log(`  ${label}: ${url} ✓ (secret unchanged — see Dashboard › Webhooks if you need it)`);
    return null;
  }
  const w = await stripe.webhookEndpoints.create({ url, enabled_events: [...events] as any, connect, description: label, api_version: '2026-08-26.dahlia' as any });
  console.log(`  ${label}: ${url} created`);
  return w.secret ?? null;
}

async function ensureThinDestination(url: string) {
  const list = await stripe.v2.core.eventDestinations.list({ include: ['webhook_endpoint.url'] });
  const found = list.data.find((d) => d.webhook_endpoint?.url === url);
  if (found) { console.log(`  Accounts v2 events: ${url} ✓`); return null; }
  const d = await stripe.v2.core.eventDestinations.create({
    name: 'Send Koro – Accounts v2 status', type: 'webhook_endpoint', event_payload: 'thin',
    enabled_events: [...THIN_EVENTS], events_from: ['@accounts'], webhook_endpoint: { url },
    include: ['webhook_endpoint.signing_secret'],
  });
  console.log(`  Accounts v2 events: ${url} created`);
  return d.webhook_endpoint?.signing_secret ?? null;
}

async function main() {
  step('Checking key and platform account');
  const platform = await stripe.accounts.retrieveCurrent();
  console.log(`  ${key.startsWith('sk_test') ? 'SANDBOX' : 'LIVE'} key for ${platform.id} (${platform.settings?.dashboard?.display_name ?? platform.business_profile?.name ?? 'unnamed'})`);
  if (expectedPlatform && platform.id !== expectedPlatform) {
    console.log(`  note: brief lists ${expectedPlatform}. Sandboxes have their own account IDs — that's expected for a sandbox key.`);
  }

  step('Billing products and monthly tier prices (restaurants only)');
  const rp = await ensureProduct('sk_restaurant_subscription', 'Send Koro Restaurant Subscription', 'Monthly plan · tier from previous month’s net food sales · $0 commission on food');
  await ensurePrices(rp, RESTAURANT_TIERS, true);
  console.log('  drivers: no subscription — drivers pay no fees (product decision). Nothing created for drivers.');

  step('Webhook endpoints');
  const secrets: Record<string, string | null> = {
    STRIPE_WEBHOOK_SECRET: await ensureWebhook(`${base}/webhooks/stripe`, PLATFORM_EVENTS, false, 'Send Koro – platform'),
    STRIPE_CONNECT_WEBHOOK_SECRET: await ensureWebhook(`${base}/webhooks/stripe/connect`, CONNECT_EVENTS, true, 'Send Koro – connected accounts'),
    STRIPE_THIN_EVENTS_SECRET: await ensureThinDestination(`${base}/webhooks/stripe/v2`),
  };

  step('Billing customer portal (restaurants update their payment method)');
  const portals = await stripe.billingPortal.configurations.list({ limit: 10 });
  if (!portals.data.some((c) => c.metadata?.send_koro === 'true')) {
    await stripe.billingPortal.configurations.create({
      business_profile: { headline: 'Send Koro — manage your restaurant plan' },
      features: { payment_method_update: { enabled: true }, invoice_history: { enabled: true }, subscription_cancel: { enabled: false } },
      metadata: { send_koro: 'true' },
    });
    console.log('  portal configuration created');
  } else console.log('  portal configuration ✓');

  if (args.has('--with-test-accounts')) {
    step('Test connected accounts (Accounts v2)');
    const portal = process.env.RESTAURANT_PORTAL_URL ?? 'https://example.com';
    const restaurant = await stripe.v2.core.accounts.create({
      display_name: 'Sandbox – Dhaka Kitchen', contact_email: 'sandbox-restaurant@sendkoro.com', dashboard: 'full', identity: { country: 'us' },
      defaults: { currency: 'usd', responsibilities: { fees_collector: 'stripe', losses_collector: 'stripe' } },
      configuration: { merchant: { capabilities: { card_payments: { requested: true } } }, customer: {} },
      metadata: { send_koro_type: 'restaurant', sandbox: 'true' },
    }, { idempotencyKey: 'sandbox-restaurant-v1' });
    const rLink = await stripe.v2.core.accountLinks.create({ account: restaurant.id, use_case: { type: 'account_onboarding', account_onboarding: { configurations: ['merchant', 'customer'], refresh_url: `${portal}/refresh`, return_url: `${portal}/return` } } });
    const driver = await stripe.v2.core.accounts.create({
      display_name: 'Sandbox – Rahim Uddin (driver)', contact_email: 'sandbox-driver@sendkoro.com', dashboard: 'full', identity: { country: 'us', entity_type: 'individual' },
      defaults: { currency: 'usd', responsibilities: { fees_collector: 'stripe', losses_collector: 'stripe' } },
      configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
      metadata: { send_koro_type: 'driver', sandbox: 'true' },
    }, { idempotencyKey: 'sandbox-driver-v2' });
    const dLink = await stripe.v2.core.accountLinks.create({ account: driver.id, use_case: { type: 'account_onboarding', account_onboarding: { configurations: ['recipient'], refresh_url: `${portal}/refresh`, return_url: `${portal}/return` } } });
    console.log(`  restaurant ${restaurant.id}\n    onboard: ${rLink.url}`);
    console.log(`  driver     ${driver.id}\n    onboard: ${dLink.url}`);
    console.log('  In the sandbox use Stripe test values: SSN 000-00-0000, DOB 01/01/1901, phone 000 000 0000, routing 110000000, account 000123456789.');
  }

  step('Done');
  const fresh = Object.entries(secrets).filter(([, v]) => v);
  if (fresh.length) {
    console.log('  Add these to .env (shown only once):');
    for (const [k, v] of fresh) console.log(`    ${k}=${v}`);
  }
  console.log('  Remaining Dashboard-only steps: ../../docs/STRIPE_DASHBOARD_CHECKLIST.md (repo root)');
}

main().catch((e) => { console.error('\n✗', e?.message ?? e); process.exit(1); });
