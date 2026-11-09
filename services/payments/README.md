# Send Koro — payments service (Stripe Connect)

This service implements the Send Koro Stripe Developer Technical Brief v1.2 for the NestJS + Drizzle + Postgres stack.

- **Direct charges on the restaurant's own Stripe account.** Food money never passes through Send Koro's balance.
- **`application_fee_amount = D + T`.** This is the delivery budget plus 100% of the driver tip. It is recorded as a *delivery fulfilment allocation*, never as a food commission.
- **Restaurant delivery rules.** Customer pays, restaurant pays, fixed or percentage split, or free above a minimum order. Each accepted rule is stored as a versioned consent and frozen into every quote.
- **Refunds by component.** Food, service charge, tax, customer delivery, subsidy restoration and tip are refunded separately. The delivery allocation is returned explicitly with an application-fee refund.
- **Own-driver payouts.** Drivers have connected Stripe accounts set up like restaurants: full Dashboard, and Stripe collects fees and covers losses. One idempotent transfer per order: the locked offer pay plus 100% of the tip. Payment waits ("owed") when the platform balance isn't available yet, and is held while a dispute is open.
- **Processing fees on delivery come out of the delivery money.** This applies to own drivers and third-party couriers alike. The restaurant's food proceeds don't pay them, and neither do the driver's pay or tip (see below).
- **Third-party couriers (Uber Direct / DoorDash Drive).** Each order's obligation, tip and invoice line is recorded and reconciled. Couriers are paid by invoice, not through Connect.
- **Restaurant subscriptions (restaurants only — drivers pay nothing).** Billed through Accounts v2 `customer_account`. The tier is set from the previous New York calendar month's net food sales by a month-end job, with no proration. A safety check pauses any renewal invoice that has no tier snapshot.
- **Webhooks.** Signature-verified, deduplicated and safe to retry. There are three endpoints: platform, connected accounts, and Accounts v2 thin events.

> **Status.** Builds clean, and **56 automated tests pass**: allocation maths, the brief's acceptance cases, real Postgres, and the real NestJS app over HTTP. It has **not yet run against Stripe itself**. The build environment couldn't reach `api.stripe.com`, so Stripe calls were checked against a recording fake that mirrors Stripe's idempotency. The first run against your sandbox is the next step (see Quick start).

## Quick start (sandbox)

```bash
cp .env.example .env            # add sk_test_ / pk_test_ keys from your Stripe sandbox
npm install
(cd ../.. && npm run db:up)     # Docker Postgres on localhost:5433 (dev + test databases)
npm run db:migrate
npm run stripe:setup -- --with-test-accounts   # products, tier prices, webhooks, test restaurant + driver
# paste the printed whsec_… secrets into .env
INTERNAL_API_KEY=dev-key npm run dev
npm test                        # uses TEST_DATABASE_URL (Docker test database by default)
```

The Dashboard-only steps (Connect settings, branding, Billing retries, team access, live activation) are in **[docs/STRIPE_DASHBOARD_CHECKLIST.md](../../docs/STRIPE_DASHBOARD_CHECKLIST.md)** (repo root).

## How an order flows

| Step | Call | What happens in Stripe |
|---|---|---|
| 1. Quote | `POST /checkout/quotes` | Nothing yet. Freezes F, S, X, D, C, R and T against the restaurant's current delivery consent, then validates that the restaurant can fund its share plus the Stripe fee. |
| 2. Pay | `POST /checkout/quotes/:id/payment` | Creates a `PaymentIntent` **on the restaurant account** (`Stripe-Account` header): `amount = Q`, `application_fee_amount = D + T − delivery fee share`, `capture_method = manual`. Returns `clientSecret` and `stripeAccount`. |
| 3. Restaurant accepts | `POST /orders/:id/accept` | Reads the card, recomputes the delivery fee share, and captures with the final `application_fee_amount`. `payment_intent.succeeded` writes the ledger and starts fulfilment. |
| 3b. Declined / 5-min timeout | `POST /orders/:id/decline` | Cancels the authorisation. The customer is never charged. |
| 4a. Own driver delivered | `POST /fulfilment/:orderId/own-driver-delivered` | `transfers.create` to the driver for the locked offer pay plus the full tip, once. |
| 4b. Third-party courier | `POST /fulfilment/:orderId/supplier-assigned` | Returns the tip in cents to send in the provider's tip field; the invoice line is reconciled later. |
| Refund | `POST /orders/:id/refunds` | Refund on the restaurant's charge, plus `applicationFees.createRefund` for the delivery portion. |

**Frontend: Stripe.js must use the restaurant account** for direct charges:

```js
const stripe = Stripe(PUBLISHABLE_KEY, { stripeAccount: res.stripeAccount });
const elements = stripe.elements({ clientSecret: res.clientSecret });
```

The customer receipt never names the courier company. `customerBreakdown()` shows only "Delivery fee". It also never adds a card processing fee, because the restaurant pays processing.

## Who pays processing fees

Stripe charges its processing fee on the whole direct charge to the restaurant's account. Send Koro's rule (3 Nov 2026) is that **the delivery money pays its own share**:

- **Delivery fee share** = Stripe fee × (C + T) ÷ Q, rounded to the cent. C + T is the delivery money the customer paid. R is food money the restaurant redirects, so it was already processed as food.
- **The restaurant is made whole** for that share. `application_fee_amount` is lowered by the share: provisionally when the PaymentIntent is created (domestic-card estimate), then finalised **at capture** from the real card. International cards cost more, so the share is recomputed then.
- **Own drivers:** the transfer is always **locked offer pay + 100% of the tip**. The fee share reduces Send Koro's delivery margin (D − driver pay − fee share), never the driver's pay. NYC's delivery-worker rules forbid deducting fees from workers' pay, and the tip must reach the driver in full.
- **Third-party couriers (Uber Direct / DoorDash Drive):** the provider is paid its full quote and the full tip through its tip field. The fee share is booked as a delivery cost. Because the delivery price equals the provider's quote, this is a small loss per order: about 33¢ on a $39 order with a $5 customer delivery fee and a $4 tip. To recover it, add the share to the delivery price at quote time (not built yet).
- **Refunds:** Stripe keeps processing fees on refunded charges. The platform returns all the application fee it actually took. The delivery's share of the lost fee is recorded as `fee_share_owed_to_restaurant`, to credit on the restaurant's next subscription invoice.
- **Example:** on a $39 order, Stripe's 2.9% + 30¢ fee is $1.44, and the delivery share is $0.33. The application fee is $14.00 − $0.33 = $13.67, and the restaurant keeps $25.00 − $1.11 (its food share of the fee).

## Formulas (brief §"Payment allocation")

`Q = F + S + X + C + T` · `A = D + T` · `restaurant keeps = F + S + X − R` · `C + R = D`. All amounts are integer cents. For percentage splits, the restaurant's share is rounded down and the remainder cent goes to the customer.

| Case (F $30, D $10) | C | R | Charge Q | Restaurant net |
|---|---|---|---|---|
| Customer pays all | $10 | $0 | $40 | $30 |
| Restaurant pays all | $0 | $10 | $30 | $20 |
| Equal partnership | $5 | $5 | $35 | $25 |
| Restaurant pays 30% | $7 | $3 | $37 | $27 |

All four cases, the $43.40 invoice example and the $39 / $14 shared-delivery example are tests in `test/allocation.test.ts`.

## Decisions to confirm (business)

1. **Tier thresholds.** `src/core/tiers.ts` uses the bands from the admin "Plans & billing" design:
   - up to $2,500 → $50
   - up to $5,000 → $100
   - up to $7,500 → $150
   - up to $10,000 → $250
   - up to $15,000 → $350
   - above $15,000 → $500

   The brief leaves these to you.
2. **No driver subscription.** Drivers pay no fees or subscription (decided 3 Nov 2026; this overrides the driver-subscription section of brief v1.2). Driver accounts only receive payouts, and nothing is created in Stripe for driver billing.
3. **First month free.** On (`FIRST_MONTH_FREE=true`): the trial lasts until the first renewal anchor.
4. **Renewal time.** Renewals happen on the 1st at 12:00 New York time. The tier job runs at 00:30 on the 1st, so refunds after midnight count in the month they're processed (the brief's proposed late-refund policy).
5. **Service charges in the tier base.** Excluded (food only), per the brief's default.
6. **Multi-location billing.** One subscription per restaurant billing entity, covering all its locations.

## Needs Stripe's written confirmation before going live

These are the brief's review questions, and the code assumes each answer is "yes":

1. Direct charges with `fees_collector = stripe`, `losses_collector = stripe` and the full Dashboard for restaurants.
2. That `application_fee_amount` may carry the delivery budget (including the restaurant-funded part) plus the full tip, less the delivery's processing-fee share.
3. That own-driver accounts with only the recipient configuration may use `fees_collector = stripe` / `losses_collector = stripe` and the full Dashboard, like restaurants. If not, switch drivers to `application` and book their payout costs as delivery costs.
4. That platform-to-driver transfers can be funded from those application-fee receipts.
5. That Send Koro's branded marketplace presentation fits restaurant-as-merchant direct charges.
6. That Billing via `customer_account` works for Accounts v2 restaurants.
7. Your fee schedule, including payout fees on own-driver accounts. The delivery markup uses `OWN_DRIVER_PAYOUT_FEE_BPS`/`_CENTS` (default 0.25% + 25¢) and `THIRD_PARTY_PAYMENT_FEE_BPS`/`_CENTS` (same default, for paying out and settling to Uber Direct and DoorDash); set them to the confirmed numbers.

If Stripe proposes a different model, change `checkout.service.ts`. The brief says not to switch silently to platform collection.

## Project layout

```
src/core/          pure money logic: allocation, refunds, tiers (no I/O; fully unit-tested)
src/payments/      Stripe + DB services: onboarding, checkout, ledger, refunds, settlement, subscriptions
src/webhooks/      signature verification, dedupe, event handling
src/jobs/          month-end tier job (00:30 ET on the 1st), owed-transfer retry (every 15 min)
src/db/schema.ts   Drizzle schema; migration in drizzle/0000_init.sql
scripts/           stripe-setup.ts (idempotent sandbox/live setup), run-tier-job.ts
test/              unit + Postgres integration + HTTP tests
```

Pinned versions: `stripe@22.6.2` (API `2026-08-26.dahlia`), NestJS 11, Drizzle 0.44, TypeScript 5.9.
