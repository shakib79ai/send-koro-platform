/** Deterministic stand-in for Uber Direct / DoorDash Drive in development and tests. */
import { randomUUID } from 'node:crypto';
import { estimateRoute } from '../../core/geo';
import type { CreateDeliveryRequest, DeliveryProviderAdapter, ProviderDelivery, ProviderQuote, QuoteRequest, ThirdPartyProvider } from './types';

export class MockProvider implements DeliveryProviderAdapter {
  readonly calls: { op: string; req: unknown }[] = [];
  /** Set to make the next quote fail (tests the fallback). */
  failQuotes = false;
  constructor(readonly name: ThirdPartyProvider, private readonly baseCents = name === 'uber_direct' ? 599 : 649) {}

  async quote(req: QuoteRequest): Promise<ProviderQuote> {
    this.calls.push({ op: 'quote', req });
    if (this.failQuotes) throw new Error(`${this.name} unavailable`);
    const r = estimateRoute([req.pickup, req.dropoff]);
    // ~ $7.80 for a typical 2 km Manhattan trip.
    const feeCents = this.baseCents + Math.round(r.distanceMeters * 0.09);
    return { provider: this.name, quoteId: `${this.name}_q_${randomUUID().slice(0, 8)}`, feeCents, expiresAt: new Date(Date.now() + 15 * 60_000), etaSeconds: r.durationSeconds + 900 };
  }
  async create(req: CreateDeliveryRequest): Promise<ProviderDelivery> {
    this.calls.push({ op: 'create', req });
    const id = `${this.name}_del_${req.externalId.slice(0, 8)}`;
    return { providerDeliveryId: id, status: 'pending', trackingUrl: `https://track.example/${id}` };
  }
  async cancel(providerDeliveryId: string) { this.calls.push({ op: 'cancel', req: providerDeliveryId }); }
}
