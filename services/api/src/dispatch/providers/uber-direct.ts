/**
 * Uber Direct (DaaS) — https://developer.uber.com/docs/deliveries
 * OAuth client_credentials (scope eats.deliveries) → delivery_quotes → deliveries.
 * Amounts are integer cents. The full tip goes in `tip` (100% to the courier).
 * Sandbox: use your Uber Direct test customer's credentials; the endpoints are the same.
 */
import type { CreateDeliveryRequest, DeliveryProviderAdapter, ProviderDelivery, ProviderQuote, QuoteRequest, Stop } from './types';
import { addressLine } from './types';

const AUTH_URL = 'https://auth.uber.com/oauth/v2/token';
const API = 'https://api.uber.com/v1/customers';

const addressJson = (s: Stop) => JSON.stringify({ street_address: [s.line1], city: s.city, state: s.state, zip_code: s.postalCode, country: 'US' });

export class UberDirectProvider implements DeliveryProviderAdapter {
  readonly name = 'uber_direct' as const;
  private token: { value: string; expiresAt: number } | null = null;
  constructor(private readonly cfg: { customerId: string; clientId: string; clientSecret: string }, private readonly fetchImpl: typeof fetch = fetch) {}

  private async accessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const res = await this.fetchImpl(AUTH_URL, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: this.cfg.clientId, client_secret: this.cfg.clientSecret, grant_type: 'client_credentials', scope: 'eats.deliveries' }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Uber auth ${res.status}`);
    const j = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: j.access_token, expiresAt: Date.now() + j.expires_in * 1000 };
    return j.access_token;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await this.fetchImpl(`${API}/${this.cfg.customerId}${path}`, {
      method: 'POST', headers: { authorization: `Bearer ${await this.accessToken()}`, 'content-type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15_000),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Uber Direct ${path} ${res.status}: ${(json as { message?: string }).message ?? ''}`);
    return json as T;
  }

  async quote(req: QuoteRequest): Promise<ProviderQuote> {
    const q = await this.post<{ id: string; fee: number; expires: string; duration?: number }>('/delivery_quotes', {
      pickup_address: addressJson(req.pickup), dropoff_address: addressJson(req.dropoff),
      pickup_latitude: req.pickup.lat, pickup_longitude: req.pickup.lng, dropoff_latitude: req.dropoff.lat, dropoff_longitude: req.dropoff.lng,
      pickup_phone_number: req.pickup.phone, dropoff_phone_number: req.dropoff.phone,
      manifest_total_value: req.orderValueCents, external_store_id: req.pickup.name,
    });
    return { provider: this.name, quoteId: q.id, feeCents: q.fee, expiresAt: new Date(q.expires), etaSeconds: (q.duration ?? 45) * 60 };
  }

  async create(req: CreateDeliveryRequest): Promise<ProviderDelivery> {
    const d = await this.post<{ id: string; status: string; tracking_url?: string; fee?: number }>('/deliveries', {
      quote_id: req.quoteId, external_id: req.externalId,
      pickup_name: req.pickup.name, pickup_address: addressJson(req.pickup), pickup_phone_number: req.pickup.phone,
      pickup_latitude: req.pickup.lat, pickup_longitude: req.pickup.lng, pickup_notes: req.pickup.instructions,
      dropoff_name: req.dropoff.name, dropoff_address: addressJson(req.dropoff), dropoff_phone_number: req.dropoff.phone,
      dropoff_latitude: req.dropoff.lat, dropoff_longitude: req.dropoff.lng, dropoff_notes: req.dropoff.instructions,
      manifest_items: req.items.map((i) => ({ name: i.name, quantity: i.quantity, size: 'small' })),
      manifest_total_value: req.orderValueCents,
      tip: req.tipCents, // 100% of the customer's tip, in cents
    });
    return { providerDeliveryId: d.id, status: d.status, trackingUrl: d.tracking_url, feeCents: d.fee };
  }

  async cancel(id: string) { await this.post(`/deliveries/${id}/cancel`, {}); }
  /** For logs only. */
  describe(req: QuoteRequest) { return `${addressLine(req.pickup)} → ${addressLine(req.dropoff)}`; }
}
