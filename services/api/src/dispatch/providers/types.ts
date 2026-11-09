import type { Point } from '../../core/geo';

export type ThirdPartyProvider = 'uber_direct' | 'doordash_drive';

export interface Stop extends Point {
  name: string; phone: string; line1: string; city: string; state: string; postalCode: string; instructions?: string;
}
export interface QuoteRequest { externalId: string; pickup: Stop; dropoff: Stop; orderValueCents: number }
export interface ProviderQuote { provider: ThirdPartyProvider; quoteId: string; feeCents: number; expiresAt: Date; etaSeconds: number }
export interface CreateDeliveryRequest extends QuoteRequest {
  quoteId?: string;
  /** Full tip in cents — 100% goes to the courier through the provider's own tip field. */
  tipCents: number;
  items: { name: string; quantity: number }[];
}
export interface ProviderDelivery { providerDeliveryId: string; status: string; trackingUrl?: string; feeCents?: number }

export interface DeliveryProviderAdapter {
  readonly name: ThirdPartyProvider;
  quote(req: QuoteRequest): Promise<ProviderQuote>;
  create(req: CreateDeliveryRequest): Promise<ProviderDelivery>;
  cancel(providerDeliveryId: string): Promise<void>;
}

export const addressLine = (s: Stop) => `${s.line1}, ${s.city}, ${s.state} ${s.postalCode}`;
