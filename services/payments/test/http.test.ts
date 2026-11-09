/** Boots the real Nest app and checks the HTTP edges: raw-body webhook signatures and the internal API guard. */
import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { Pool } from 'pg';
import { signedEvent } from './fake-stripe';
import { runMigrations } from '../src/db/migrate';

const URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5433/sendkoro_test';
Object.assign(process.env, {
  STRIPE_SECRET_KEY: 'sk_test_http', STRIPE_WEBHOOK_SECRET: 'whsec_http_platform', STRIPE_CONNECT_WEBHOOK_SECRET: 'whsec_http_connect',
  PUBLIC_BASE_URL: 'https://api.sendkoro.test', RESTAURANT_PORTAL_URL: 'https://r.test', DRIVER_APP_URL: 'https://d.test',
  DATABASE_URL: URL, INTERNAL_API_KEY: 'internal-test-key',
});

let app: INestApplication; let base: string;

beforeAll(async () => {
  const p = new Pool({ connectionString: URL });
  await p.query('drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;');
  await p.end();
  await runMigrations(URL);
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../src/app.module');
  app = await NestFactory.create(AppModule, { rawBody: true, logger: false });
  await app.listen(0);
  base = await app.getUrl();
});
afterAll(async () => { await app?.close(); });

describe('HTTP', () => {
  it('health check is public', async () => {
    expect(await (await fetch(`${base}/health`)).json()).toEqual({ ok: true, service: 'send-koro-payments' });
  });
  it('accepts a correctly signed connect webhook (raw body preserved) and dedupes the retry', async () => {
    const { payload, header } = signedEvent('whsec_http_connect', { id: 'evt_http_1', type: 'payout.paid', account: 'acct_x', data: { object: { id: 'po_1', object: 'payout' } } });
    const send = () => fetch(`${base}/webhooks/stripe/connect`, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': header }, body: payload });
    const r1 = await send();
    expect(r1.status).toBe(200);
    expect(await r1.json()).toEqual({ received: true, processed: true });
    expect(await (await send()).json()).toEqual({ received: true, processed: false });
  });
  it('rejects a webhook signed with the wrong secret', async () => {
    const { payload, header } = signedEvent('whsec_wrong', { id: 'evt_http_2', type: 'payout.paid', data: { object: {} } });
    const r = await fetch(`${base}/webhooks/stripe`, { method: 'POST', headers: { 'content-type': 'application/json', 'stripe-signature': header }, body: payload });
    expect(r.status).toBe(400);
  });
  it('internal payment API requires the service key', async () => {
    const r = await fetch(`${base}/checkout/quotes`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(r.status).toBe(401);
    const ok = await fetch(`${base}/checkout/quotes`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-internal-key': 'internal-test-key' }, body: '{}' });
    expect(ok.status).toBe(400); // passes the guard, fails validation
  });
});
