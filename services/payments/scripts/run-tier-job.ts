/** Manual tier run: npm run tiers:run -- 2026-10   (defaults to the previous New York calendar month) */
import 'dotenv/config';
import { loadEnv } from '../src/config/env';
import { createDb } from '../src/db/client';
import { createStripe } from '../src/stripe/stripe.client';
import { LedgerService } from '../src/payments/ledger.service';
import { SubscriptionsService } from '../src/payments/subscriptions.service';

async function main() {
  const env = loadEnv();
  const stripe = createStripe(env.STRIPE_SECRET_KEY);
  const { db, pool } = createDb(env.DATABASE_URL);
  const subs = new SubscriptionsService(stripe, db, new LedgerService(stripe, db), { firstMonthFree: env.FIRST_MONTH_FREE, alert: console.error });
  const res = await subs.runRestaurantTierJob(process.argv[2]);
  console.table(res);
  await pool.end();
}
main();
