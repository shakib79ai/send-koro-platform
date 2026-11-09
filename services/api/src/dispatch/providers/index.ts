import type { Env } from '../../config/env';
import { MockProvider } from './mock';
import { UberDirectProvider } from './uber-direct';
import { DoorDashDriveProvider } from './doordash-drive';
import type { DeliveryProviderAdapter, ThirdPartyProvider } from './types';

export function buildProviders(env: Env): Partial<Record<ThirdPartyProvider, DeliveryProviderAdapter>> {
  const need = (v: string | undefined, name: string) => { if (!v) throw new Error(`${name} is required when its provider mode is not mock`); return v; };
  return {
    uber_direct: env.UBER_DIRECT_MODE === 'mock' ? new MockProvider('uber_direct') : new UberDirectProvider({
      customerId: need(env.UBER_DIRECT_CUSTOMER_ID, 'UBER_DIRECT_CUSTOMER_ID'), clientId: need(env.UBER_DIRECT_CLIENT_ID, 'UBER_DIRECT_CLIENT_ID'), clientSecret: need(env.UBER_DIRECT_CLIENT_SECRET, 'UBER_DIRECT_CLIENT_SECRET'),
    }),
    doordash_drive: env.DOORDASH_DRIVE_MODE === 'mock' ? new MockProvider('doordash_drive') : new DoorDashDriveProvider({
      developerId: need(env.DOORDASH_DEVELOPER_ID, 'DOORDASH_DEVELOPER_ID'), keyId: need(env.DOORDASH_KEY_ID, 'DOORDASH_KEY_ID'), signingSecret: need(env.DOORDASH_SIGNING_SECRET, 'DOORDASH_SIGNING_SECRET'),
    }),
  };
}
