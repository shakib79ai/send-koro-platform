/** Boots the real Nest app: auth guard, roles, /v1 prefix, raw-body webhook signatures. */
import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { Pool } from 'pg';
import { runMigrations } from '../src/db/migrate';
import { TOKENS } from '../src/common/tokens';
import type { ConsoleSms } from '../src/integrations/sms';

const URL = process.env.TEST_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5433/sendkoro_api_test';
Object.assign(process.env, {
  NODE_ENV: 'test', DATABASE_URL: URL, JWT_SECRET: 'http-test-secret-0123456789abcdefghij',
  PAYMENTS_URL: 'http://127.0.0.1:9', PAYMENTS_INTERNAL_KEY: 'internal-test-key', UBER_DIRECT_WEBHOOK_SECRET: 'uber-hook-secret',
});

let app: INestApplication; let base: string;

beforeAll(async () => {
  const p = new Pool({ connectionString: URL });
  await p.query('drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;');
  await p.end();
  await runMigrations(URL);
  const { NestFactory } = await import('@nestjs/core');
  const { AppModule } = await import('../src/app.module');
  const { configureApp } = await import('../src/app.setup');
  const { loadEnv } = await import('../src/config/env');
  app = await NestFactory.create(AppModule, { rawBody: true, logger: false });
  configureApp(app, loadEnv());
  await app.listen(0);
  base = (await app.getUrl()).replace('[::1]', '127.0.0.1');
});
afterAll(async () => { await app?.close(); });

const json = (method: string, path: string, body?: unknown, token?: string) => fetch(`${base}${path}`, {
  method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined,
});

describe('HTTP', () => {
  it('health is public and unprefixed', async () => {
    const r = await fetch(`${base}/health`);
    expect(await r.json()).toEqual({ ok: true, service: 'send-koro-api' });
  });

  it('phone sign-in over HTTP, then role checks', async () => {
    expect((await json('GET', '/v1/orders')).status).toBe(401);
    expect((await json('POST', '/v1/auth/code', { phone: '917-555-0100', role: 'customer' })).status).toBe(400);
    expect((await json('POST', '/v1/auth/code', { phone: '+19175550100', role: 'customer' })).status).toBe(201);
    const sms = app.get<ConsoleSms>(TOKENS.sms);
    const code = sms.sent.at(-1)!.body.slice(0, 6);
    const v = await json('POST', '/v1/auth/verify', { phone: '+19175550100', role: 'customer', code, name: 'Ayesha' });
    const session = (await v.json()) as { accessToken: string; refreshToken: string; user: unknown };
    expect(session.user).toMatchObject({ role: 'customer', name: 'Ayesha' });
    expect((await json('GET', '/v1/auth/me', undefined, session.accessToken)).status).toBe(200);
    expect((await json('GET', '/v1/orders', undefined, session.accessToken)).status).toBe(200);
    expect((await json('GET', '/v1/admin/overview', undefined, session.accessToken)).status).toBe(403);
    expect((await json('GET', '/v1/auth/me', undefined, session.refreshToken)).status).toBe(401);
  });

  it('public catalog needs no sign-in', async () => {
    const r = await fetch(`${base}/v1/catalog/restaurants?lat=40.74&lng=-73.99`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual([]);
  });

  it('Uber Direct webhooks must carry a valid signature over the raw body', async () => {
    const body = JSON.stringify({ kind: 'event.delivery_status', status: 'pickup_complete', delivery_id: 'del_unknown' });
    const bad = await fetch(`${base}/webhooks/uber-direct`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-uber-signature': 'nope' }, body });
    expect(bad.status).toBe(401);
    const sig = createHmac('sha256', 'uber-hook-secret').update(body).digest('hex');
    const ok = await fetch(`${base}/webhooks/uber-direct`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-uber-signature': sig }, body });
    expect(ok.status).toBe(200);
  });
});
