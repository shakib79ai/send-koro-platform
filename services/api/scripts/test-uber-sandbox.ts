import 'dotenv/config';
import { UberDirectProvider } from '../src/dispatch/providers/uber-direct';

async function main() {
  if (process.env.UBER_DIRECT_MODE !== 'sandbox') {
    throw new Error('Set UBER_DIRECT_MODE=sandbox in services/api/.env. Live and mock modes are not accepted.');
  }
  const createDelivery = process.argv.includes('--create-delivery');

  const customerId = process.env.UBER_DIRECT_CUSTOMER_ID;
  const clientId = process.env.UBER_DIRECT_CLIENT_ID;
  const clientSecret = process.env.UBER_DIRECT_CLIENT_SECRET;
  if (!customerId || !clientId || !clientSecret) {
    throw new Error('Set the Uber Direct test Customer ID, Client ID, and Client Secret in services/api/.env.');
  }

  const provider = new UberDirectProvider({ customerId, clientId, clientSecret });
  const request = {
    externalId: `send-koro-sandbox-${Date.now()}`,
    pickup: {
      name: 'Send Koro Sandbox Pickup',
      phone: '+15555555555',
      line1: '20 W 34th St',
      city: 'New York',
      state: 'NY',
      postalCode: '10001',
      lat: 40.74868,
      lng: -73.98561,
    },
    dropoff: {
      name: 'Send Koro Sandbox Dropoff',
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
  const quote = await provider.quote(request);

  console.log('Uber Direct sandbox authentication and quote succeeded.');
  console.log(`Quote ID: ${quote.quoteId}`);
  console.log(`Fee: ${quote.feeCents} cents`);
  console.log(`Expires: ${quote.expiresAt.toISOString()}`);
  console.log(`Estimated duration: ${quote.etaSeconds} seconds`);

  if (createDelivery) {
    const delivery = await provider.create({
      ...request,
      quoteId: quote.quoteId,
      tipCents: 0,
      items: [{ name: 'Sandbox test item', quantity: 1 }],
      testSpecifications: { robo_courier_specification: { mode: 'auto' } },
    });
    console.log('Uber Direct Robo Courier sandbox delivery created.');
    console.log(`Delivery ID: ${delivery.providerDeliveryId}`);
    console.log(`Initial status: ${delivery.status}`);
    if (delivery.trackingUrl) console.log(`Tracking URL: ${delivery.trackingUrl}`);
  } else {
    console.log('No delivery was created. Add --create-delivery to run a Robo Courier sandbox delivery.');
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  console.error(`Uber Direct sandbox test failed: ${message}`);
  process.exitCode = 1;
});
