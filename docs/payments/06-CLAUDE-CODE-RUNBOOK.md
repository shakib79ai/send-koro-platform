# 6. Runbook for Claude Code (and developers)

Work through the tasks in order. Each has commands and a check that must pass before moving on. Stop and ask the person when a step is marked **Person** or **Needs confirmation**.

## Guardrails (read every time)

- **Sandbox only.** Keys must start with `sk_test_` / `rk_test_`. If you see `sk_live_` anywhere, stop. Never print a key, never read or echo `.env`.
- Don't change live-mode settings through the Stripe MCP server; use it only to look things up in the sandbox.
- Dashboard-only settings (`docs/STRIPE_DASHBOARD_CHECKLIST.md`) are done by a person. Don't try to automate them.
- Money is integer cents; pure logic in `src/core/`, Stripe calls in `src/payments/`.
- Every Stripe write has an idempotency key built from our own IDs; every new table that records money has a unique constraint.
- Run `/check-business-rules` before finishing a money change; `npm test` must pass.
- Explain each money change with a worked example in cents.

## A. Set up a sandbox (Built)

| # | Step | Command / action | Check |
|---|---|---|---|
| A1 | **Person:** create a Stripe sandbox, turn on Connect (marketplace, direct charges, Stripe-handled pricing, full Dashboard), add branding | Dashboard checklist §1–3 | Connect settings saved |
| A2 | Put the sandbox keys in the environment (person, or a secrets manager) | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_PLATFORM_ACCOUNT_ID` | `node -e "console.log(process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_'))"` prints `true` |
| A3 | Install, database, migrate | `npm run setup && npm run db:up && npm run db:migrate` | no errors |
| A4 | Create the catalog, webhooks and portal | `npm run stripe:setup` (or `/stripe-setup`); add `-- --with-test-accounts` for a test restaurant and driver | six tier prices with lookup keys; 3 webhook endpoints; secrets printed once → put them in the environment |
| A5 | Forward webhooks | `npm run stripe:listen` | `stripe trigger payment_intent.succeeded --stripe-account acct_…` reaches `/webhooks/stripe/connect` and is stored once in `stripe_events` |
| A6 | Tests | `npm test` | payments and API suites pass |
| A7 | Seed | `npm run seed:admin -- +1917… "Name"`, `npm run seed:demo` | demo restaurant visible in the portals |

## B. Check the built money paths end to end (sandbox)

1. Onboard the test restaurant (portal → Stripe tab → onboarding, test data in document 2 §2.8). Check `onboarding_status = active` after the return page.
2. Order $30.00 food with the split rule. Check the PaymentIntent on the **restaurant** account: amount 4354, application fee 1349, `capture_method = manual`.
3. Accept → captured. Decline another order → authorisation cancelled.
4. Mark an own-driver delivery → one transfer of 1320 to the driver; repeating the call creates nothing.
5. Refund the food → refund on the restaurant charge; delivery part returned by application-fee refund.
6. `/tier-job 2026-10` dry run → explains each restaurant's tier.

## C. Build tasks (in this order)

| # | Task | Document | Done when |
|---|---|---|---|
| C1 | Fix the stale `services/payments/README.md` (still says A = D + T without the fee share and describes old subscription rules) | 1, 3 | README matches documents 1–4 |
| C2 | Per-location plan lines: $0 base price, invoice item per live location, snapshots per location | 3 §3.4 | tests in 3 §3.4 pass |
| C3 | Credit the `fee_share_owed_to_restaurant` on the plan invoice | 1 §1.7, 3 §3.5 | negative line appears; idempotent |
| C4 | Wallet and credit ledger (payments): tables, grant, balance, debit on payment, reversal | 5 §5.3–5.4 | tests 1–5 in 5 §5.7 |
| C5 | `priceDelivery` and quotes with credit | 5 §5.2 | test 2 in 5 §5.7 |
| C6 | Referral codes, promo codes, settings (API) + phone-verified checks | 5 §5.3–5.5 | API tests: one referral per friend, monthly cap, promo once per customer |
| C7 | Month-end credit pay-back: invoice line + excess transfer | 3 §3.5, 5 §5.4 | test 6 in 5 §5.7 |
| C8 | Apps: customer wallet / refer / sign-up code / checkout toggle; restaurant credit lines and card; admin Customer credit page | prototypes | screens call the new endpoints; totals still come only from the API |
| C9 | Restaurant promotions (restaurant-funded, lower F) | 1 §1.8 | tests: discount lowers F and net food sales; no Send Koro charge |
| C10 | Saved cards across restaurants (platform customer + clone to each restaurant account) | 2 §2.9 item 9 | **Needs confirmation** first |

## D. Going live (Person + Claude Code)

1. **Person:** activate the live account, complete the Dashboard checklist in live mode (Billing retries, emails, branding, payment method domain), get the written answers in document 2 §2.9.
2. Create a **restricted** live key with only the scopes in the checklist; store it in the server's secrets (never in the repo).
3. Run `npm run stripe:setup` against live **only when the person asks**, from the server, with the live key in the environment; record the webhook secrets in the server's secrets.
4. Deploy (`docs/DEPLOYMENT.md`). Check webhook deliveries in the Dashboard and a $1 test order with a real card, refunded at once.

## Built vs to build (summary)

| Area | Status |
|---|---|
| Delivery pricing, application fee with fee share, direct charges, capture on accept, decline | Built |
| Refunds by component, application-fee refunds | Built |
| Restaurant and driver Accounts v2 onboarding, sync, payment method domain | Built |
| Stripe tab (embedded components for restaurants, native screens for drivers) | Built |
| Own-driver transfers, owed retry, dispute hold, NYC top-ups | Built |
| Third-party courier obligations, tip pass-through, reconciliation | Built |
| One subscription per restaurant with tier job and safety net | Built |
| Per-location plan lines on one invoice | To build (C2) |
| Fee share owed credited on invoice | To build (C3) |
| Wallet, promo codes, referrals, credit pay-back | To build (C4–C8) |
| Restaurant promotions | To build (C9) |
| Saved cards across restaurants, excess-credit transfer capability, recipient-driver fees | Needs confirmation |
