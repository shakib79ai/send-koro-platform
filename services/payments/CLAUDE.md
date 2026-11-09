# Payments service

Implements `docs/STRIPE_TECHNICAL_BRIEF.md`, as amended by `docs/BUSINESS_MODEL.md`. The root `CLAUDE.md` rules apply here too.

## Map

| Path | What it does |
|---|---|
| `src/core/allocation.ts` | F, S, X, D, R, C, T → Q, A, restaurant retained; delivery fee share; `priceDelivery` (courier price + payout cost + card share = D); validation. Pure, no I/O. |
| `src/core/refunds.ts` | Component refunds → charge refund + application-fee refund. |
| `src/core/tiers.ts` | Restaurant subscription tiers, New York month boundaries, renewal anchor (12:00 ET on the 1st). |
| `src/payments/checkout.service.ts` | Quote freeze → PaymentIntent on the restaurant account (manual capture) → accept/capture with final application fee. |
| `src/payments/ledger.service.ts` | Per-order ledger, idempotent by `dedupe_key`; tier base query. |
| `src/payments/refunds.service.ts` | Executes refund plans on Stripe; caps application-fee refunds at what was taken. |
| `src/payments/settlement.service.ts` | Own-driver transfers (pay + full tip, once), owed/retry, dispute hold; NYC minimum-pay weekly top-ups (once per driver per week); third-party obligations and reconciliation. |
| `src/payments/subscriptions.service.ts` | Restaurant plan via `customer_account`, month-end tier job, renewal invoice safety net. |
| `src/payments/registry.service.ts` | Mirror of the core API's restaurants and drivers; tax acceptance; versioned delivery-fee consents; payout readiness. |
| `src/payments/onboarding.service.ts` | Accounts v2 for restaurants (merchant + customer) and drivers (recipient), hosted onboarding, capability sync. |
| `src/webhooks/` | Platform, connect and Accounts v2 thin-event endpoints; signature check + dedupe. |
| `src/db/schema.ts` | Drizzle schema. Migrations live in `drizzle/` and are generated, never hand-edited. |
| `scripts/stripe-setup.ts` | Idempotent Stripe setup: products, prices, webhooks, event destination, portal, test accounts. |

## Who calls this service

Only `services/api`, through `x-internal-key`, using `services/api/src/integrations/payments.client.ts`. When you add or change an endpoint here, update that client and the API's `test/fake-payments.ts`.

## Working here

- **Schema change:** edit `src/db/schema.ts`, run `npx drizzle-kit generate --name <what>`, then `npm run db:migrate` and `npm test`.
- **New Stripe call:** pass `stripeAccount` for anything about a restaurant's charge or refund, and always pass an `idempotencyKey` derived from our own IDs (e.g. `order-pi:${orderId}`). Check the request types in `node_modules/stripe/cjs/resources/**` rather than guessing field names.
- **Tests:**
  - `test/allocation.test.ts` and `test/refunds-tiers.test.ts` are pure.
  - `test/integration.test.ts` uses real Postgres plus `test/fake-stripe.ts`, which records calls and mimics idempotency.
  - `test/http.test.ts` boots the real Nest app.
  - When you add a Stripe method to a service, add it to the fake too.
  - Tests need `TEST_DATABASE_URL`, which defaults to the Docker Postgres from the root `docker-compose.yml`.
- **Dependency injection:** providers use explicit factory functions in `src/app.module.ts` (no reliance on `emitDecoratorMetadata`), so services stay plain classes that tests construct directly.
- **The pinned Stripe API version** lives in `src/stripe/stripe.client.ts`. Bump it only on purpose, together with the SDK.

## Not built yet (ask before assuming)

- Crediting `fee_share_owed_to_restaurant` on the restaurant's next subscription invoice.
- The fulfilment trigger in `app.module.ts` only logs. Dispatch lives in `services/api`, which starts it right after a successful capture.
- Real service authentication. `InternalApiGuard` is a shared-key placeholder.
