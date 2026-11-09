# Core API

Everything the apps talk to: sign-in, restaurants, menus, ordering, dispatch, drivers and admin. It never calls Stripe directly. All money moves through `services/payments` over its internal API (`src/integrations/payments.client.ts`). The root `CLAUDE.md` rules apply here too. Endpoint list: `docs/API.md`.

## Map

| Path | What it does |
|---|---|
| `src/core/` | **Pure logic, no I/O.** `cart.ts` (food, restaurant fees, restaurant tax in ppm), `receipt.ts` (customer lines; must equal the charged total), `batching.ts` (2 orders on one route; driver pay = each order's delivery fee − card share − payout cost = courier price P), `rate-card.ts` (fallback pay, NYC minimum), `order-status.ts`, `hours.ts`, `tax.ts` (launch states), `geo.ts`, `money.ts` |
| `src/auth/` | Phone code sign-in, JWT access + rotating refresh tokens, global `AuthGuard`, `@Roles()`, `@Public()` |
| `src/restaurants/` | Profile, locations, hours, team, taxes & fees, delivery-fee rule (sent to payments as a versioned consent), go-live checklist |
| `src/menu/`, `src/catalog/` | Menu editor; public browsing |
| `src/orders/` | `orders.service.ts`: preview → place → payment confirmed → accept/decline → ready. `order-state.service.ts` is the only place status changes |
| `src/dispatch/` | Provider adapters (Uber Direct, DoorDash Drive, mock), own-driver offer engine (`tick()`), provider webhooks |
| `src/drivers/` | Apply, online, offers, pickup/dropoff, earnings, weekly NYC top-up |
| `src/admin/` | Operations, approvals, refunds, dispatch retry |
| `src/realtime/` | In-process event bus + SSE endpoints |
| `src/jobs/api.jobs.ts` | Auto-decline (5 min), payment sweep, offer engine, Monday NYC top-ups |

## Rules specific to this service

- **The customer receipt must equal the payments service's `Q`.** `buildReceipt` throws if it doesn't. Never add a line that isn't in the allocation.
- **Never show the courier company to customers or restaurants.** Provider names and third-party tracking links appear only in `admin` responses. Tests check customer JSON for `uber|doordash`.
- **Tax rates are restaurant-set, stored in parts per million** (`taxRatePpm`, 88750 = 8.875%). Never compute tax from anything else, and never add a platform tax.
- **Driver pay is fixed when the offer is accepted** (`deliveries.driver_pay_cents`). Nothing may lower it later. On delivery, `payments.ownDriverDelivered` transfers exactly that plus the full tip.
- **Order status changes only through `OrderStateService.transition`.** It runs a conditional update, so repeats and races are safe.
- **New states for launch:** `src/core/tax.ts` → `LAUNCH_STATES`. Add one only after legal review (marketplace-facilitator law).

## Working here

- **Schema change:** edit `src/db/schema.ts`, run `npx drizzle-kit generate --name <what>`, then `npm run db:migrate` and `npm test`.
- **Dependency injection:** factory providers live in `src/app.module.ts`. Anything Nest constructs itself needs an explicit `@Inject(...)` on each constructor parameter, because tests run without decorator metadata.
- **Tests:**
  - `test/core.test.ts`: pure logic.
  - `test/flow.test.ts`: real Postgres, `test/fake-payments.ts` and mock couriers. Covers whole order journeys.
  - `test/http.test.ts`: boots the app.
  - When you add a payments call, add it to the fake too.
- **Local run:** start the payments service on :3000 (`npm run dev` from the root), then this one on :3001 (`npm run dev:api`). Sign-in codes print in the API log (`SMS_PROVIDER=console`).

## Not built yet (ask before assuming)

- **Push via FCM/APNs:** `ConsolePush` only logs today; the interface is in `src/integrations/push.ts`.
- **Routing API for offer distance and time:** `core/geo.ts` estimates with a grid factor. Use Google Routes or Mapbox before launch, so locked pay matches real trips.
- **Address autocomplete and geocoding:** the apps must send `lat`/`lng`.
- **Monthly delivery budget enforcement:** the budget is stored with the consent but not yet tracked per month.
- **Proof-of-delivery photo upload:** the endpoint takes a URL; storage (S3) is not wired.
- **Multi-instance live updates:** `EventBus` is in-memory.
