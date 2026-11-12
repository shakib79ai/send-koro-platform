import { describe, expect, it, vi } from 'vitest';
import { UberDirectProvider } from '../src/dispatch/providers/uber-direct';

describe('UberDirectProvider', () => {
  it('sends Robo Courier test specifications only when requested', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'test-token', expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'quote-test', fee: 100, expires: '2026-11-12T00:00:00Z' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'delivery-test', status: 'pending' }), { status: 200 }));
    const provider = new UberDirectProvider(
      { customerId: 'customer-test', clientId: 'client-test', clientSecret: 'secret-test' },
      fetchImpl,
    );
    const request = {
      externalId: 'send-koro-test',
      pickup: {
        name: 'Pickup',
        phone: '+15555555555',
        line1: '20 W 34th St',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        lat: 40.74868,
        lng: -73.98561,
      },
      dropoff: {
        name: 'Dropoff',
        phone: '+15555555555',
        line1: '285 Fulton St',
        city: 'New York',
        state: 'NY',
        postalCode: '10006',
        lat: 40.71301,
        lng: -74.01317,
      },
      orderValueCents: 1000,
    };

    await provider.create({
      ...request,
      quoteId: 'quote-test',
      tipCents: 0,
      items: [{ name: 'Test item', quantity: 1 }],
      testSpecifications: { robo_courier_specification: { mode: 'auto' } },
    });

    const createCall = fetchImpl.mock.calls[1];
    expect(createCall[0]).toBe('https://api.uber.com/v1/customers/customer-test/deliveries');
    expect(JSON.parse(String(createCall[1]?.body))).toMatchObject({
      quote_id: 'quote-test',
      tip: 0,
      test_specifications: { robo_courier_specification: { mode: 'auto' } },
    });
  });

  it('does not send test specifications for normal delivery requests', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: 'test-token', expires_in: 3600 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'delivery-test', status: 'pending' }), { status: 200 }));
    const provider = new UberDirectProvider(
      { customerId: 'customer-test', clientId: 'client-test', clientSecret: 'secret-test' },
      fetchImpl,
    );

    await provider.create({
      externalId: 'send-koro-test',
      pickup: {
        name: 'Pickup',
        phone: '+15555555555',
        line1: '20 W 34th St',
        city: 'New York',
        state: 'NY',
        postalCode: '10001',
        lat: 40.74868,
        lng: -73.98561,
      },
      dropoff: {
        name: 'Dropoff',
        phone: '+15555555555',
        line1: '285 Fulton St',
        city: 'New York',
        state: 'NY',
        postalCode: '10006',
        lat: 40.71301,
        lng: -74.01317,
      },
      orderValueCents: 1000,
      tipCents: 0,
      items: [{ name: 'Test item', quantity: 1 }],
    });

    const createCall = fetchImpl.mock.calls[1];
    expect(JSON.parse(String(createCall[1]?.body))).not.toHaveProperty('test_specifications');
  });
});
