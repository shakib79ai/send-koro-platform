/**
 * DoorDash Drive v2 — https://developer.doordash.com/en-US/docs/drive/
 * Auth: a short-lived JWT (HS256, header dd-ver: DD-JWT-V1) signed with the base64url-decoded
 * signing secret. Quote → accept quote (with tip). DoorDash requires 100% tip pass-through.
 */
import { createHmac } from 'node:crypto';
import type { CreateDeliveryRequest, DeliveryProviderAdapter, ProviderDelivery, ProviderQuote, QuoteRequest } from './types';
import { addressLine } from './types';

const API = 'https://openapi.doordash.com/drive/v2';
const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

export function doordashJwt(cfg: { developerId: string; keyId: string; signingSecret: string }, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT', 'dd-ver': 'DD-JWT-V1' }));
  const payload = b64url(JSON.stringify({ aud: 'doordash', iss: cfg.developerId, kid: cfg.keyId, iat: nowSeconds, exp: nowSeconds + 300 }));
  const sig = createHmac('sha256', Buffer.from(cfg.signingSecret, 'base64url')).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

export class DoorDashDriveProvider implements DeliveryProviderAdapter {
  readonly name = 'doordash_drive' as const;
  constructor(private readonly cfg: { developerId: string; keyId: string; signingSecret: string }, private readonly fetchImpl: typeof fetch = fetch) {}

  private async call<T>(method: 'POST' | 'PUT', path: string, body: unknown): Promise<T> {
    const res = await this.fetchImpl(`${API}${path}`, {
      method, headers: { authorization: `Bearer ${doordashJwt(this.cfg)}`, 'content-type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15_000),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`DoorDash ${path} ${res.status}: ${(json as { message?: string }).message ?? ''}`);
    return json as T;
  }

  async quote(req: QuoteRequest): Promise<ProviderQuote> {
    const q = await this.call<{ external_delivery_id: string; fee: number; dropoff_time_estimated?: string }>('POST', '/quotes', {
      external_delivery_id: req.externalId,
      pickup_address: addressLine(req.pickup), pickup_business_name: req.pickup.name, pickup_phone_number: req.pickup.phone,
      dropoff_address: addressLine(req.dropoff), dropoff_contact_given_name: req.dropoff.name, dropoff_phone_number: req.dropoff.phone,
      order_value: req.orderValueCents,
    });
    const eta = q.dropoff_time_estimated ? Math.max(0, Math.round((new Date(q.dropoff_time_estimated).getTime() - Date.now()) / 1000)) : 2700;
    // DoorDash quotes are valid for 5 minutes.
    return { provider: this.name, quoteId: q.external_delivery_id, feeCents: q.fee, expiresAt: new Date(Date.now() + 5 * 60_000), etaSeconds: eta };
  }

  async create(req: CreateDeliveryRequest): Promise<ProviderDelivery> {
    const id = req.quoteId ?? req.externalId;
    const d = await this.call<{ external_delivery_id: string; delivery_status: string; tracking_url?: string; fee?: number }>('POST', `/quotes/${id}/accept`, {
      tip: req.tipCents, // 100% pass-through, cents
    });
    return { providerDeliveryId: d.external_delivery_id, status: d.delivery_status, trackingUrl: d.tracking_url, feeCents: d.fee };
  }

  async cancel(id: string) { await this.call('PUT', `/deliveries/${id}/cancel`, {}); }
}
