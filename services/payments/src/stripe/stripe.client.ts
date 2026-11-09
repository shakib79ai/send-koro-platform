import Stripe from 'stripe';

/** Pinned so a dashboard API-version bump never changes behaviour silently. Matches stripe-node 22.6.x. */
export const STRIPE_API_VERSION = '2026-08-26.dahlia' as const;

export function createStripe(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
    maxNetworkRetries: 2,
    timeout: 20_000,
    appInfo: { name: 'Send Koro', url: 'https://sendkoro.com', version: '0.1.0' },
  });
}
