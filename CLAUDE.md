# Send Koro

NYC food-delivery marketplace. Restaurants pay a flat monthly plan and **$0 commission**. Customers order on the web, PWA, iOS and Android. Delivery runs through Uber Direct, DoorDash Drive, or Send Koro's own drivers. Payments use Stripe Connect **direct charges**: food money goes straight to each restaurant's own Stripe account.

**Start here:** `docs/CLAUDE_CODE_KICKOFF.md` (what to do, in order) and `docs/DESIGN_TO_CODE.md` (what each app still needs to match the designs).

Read before changing anything money-related:
- `docs/BUSINESS_MODEL.md` — every business decision to date. **It overrides the brief where they differ.**
- `docs/payments/` — **payments developer documents**: money model, Stripe Connect setup, catalog and subscriptions, driver and courier pay, credit/referral/wallet, and a step-by-step runbook for Claude Code. Start with `docs/payments/README.md`.
- `docs/STRIPE_TECHNICAL_BRIEF.md` — the Stripe developer brief (v1.2) the payments service implements.
- `docs/DESIGNS.md` — the approved designs: clickable prototypes in `designs/prototypes/` (open in a browser) and claude.ai links.
- `docs/API.md` — the core API the apps call. `docs/DEPLOYMENT.md` — server, CI/CD, going live.

## Repository

```
apps/customer-web/   Customer web + PWA (Next.js 15). Totals come only from the API; Stripe.js uses the restaurant's account.
apps/restaurant-web/ Restaurant portal web + PWA (Next.js 15): live orders, menu, earnings, plan, settings. Roles enforced by the API.
apps/admin-web/      Admin console (Next.js 15): operations, orders/refunds, dispatch, partners, money (payouts, settlements, billing), tax compliance.
apps/customer-app/   Customer app, Flutter (iOS + Android): same features as customer web; Stripe payment sheet on the restaurant's account. Checked by CI.
apps/driver-app/     Driver app, Flutter (iOS + Android): locked offers, trips, earnings, NYC minimum. Checked by CI (analyze, test, APK).
services/api/        Core API (NestJS 11 + Drizzle): sign-in, restaurants, menus, orders, dispatch, drivers, admin. Has its own CLAUDE.md.
services/payments/   Payments service (Stripe Connect). Only this service talks to Stripe. Has its own CLAUDE.md.
designs/             Approved clickable prototypes (prototypes/*.html) and their source (source/, rebuild with python3 build.py)
deploy/              Production Docker Compose, Caddy (auto-HTTPS), env templates
.github/workflows/   CI (typecheck + tests for both services) and Deploy (GHCR images → VPS over SSH)
docs/                business model, Stripe brief, Dashboard checklist, design links, API reference, deployment
docker/              local Postgres init
.claude/commands/    project slash commands (/test, /stripe-setup, /new-migration, /check-business-rules, /tier-job)
```

Apps call `services/api` (`/v1`). The API calls `services/payments` over an internal, key-protected API; payments is never exposed publicly except Stripe's webhook paths.

Stack: TypeScript, NestJS, Drizzle ORM, PostgreSQL, Next.js (for future web apps), Stripe (`stripe@22.6.2`, API `2026-08-26.dahlia`).

## Commands (run from the repo root)

| Task | Command |
|---|---|
| Install | `npm run setup` |
| Start Postgres (Docker) | `npm run db:up` |
| Migrate | `npm run db:migrate` |
| Run payments (:3000) / core API (:3001) / customer web (:3100) / restaurant portal (:3200) / admin (:3300) | `npm run dev` / `npm run dev:api` / `npm run dev:customer` / `npm run dev:restaurant` / `npm run dev:admin` |
| Tests, both services (needs `db:up`) | `npm test` (`npm run test:api`, `npm run test:payments`) |
| First admin / demo restaurant | `npm run seed:admin -- +1917… "Name"` / `npm run seed:demo` |
| Typecheck | `npm run typecheck` |
| Stripe sandbox setup | `npm run stripe:setup` |
| Forward Stripe webhooks locally | `npm run stripe:listen` |

## Rules that must never be broken

1. **Money is integer cents.** No floats, no rounding except the documented rules in `services/payments/src/core/allocation.ts`.
2. **Direct charges only.** Create order PaymentIntents with the restaurant's `stripeAccount`. Never use a platform charge with `transfer_data` to collect food money (brief §"Proposed direct charge routing").
3. **`application_fee_amount = D + T − delivery fee share`.** It is a delivery fulfilment allocation, never a food commission.
4. **Customers never see the courier company.** The receipt says "Delivery fee"; "Uber Direct" and "DoorDash" appear only in admin.
5. **Customers never pay card processing fees.** Restaurants pay processing on food. The delivery money pays its own share.
6. **Drivers' locked offer pay and tips are never reduced.** No fees are deducted from driver pay or tips (NYC delivery-worker rules); 100% of every tip goes to the courier. There is no driver subscription.
7. **Send Koro never collects, files or pays sales tax.** Restaurants set and remit their own tax. Don't launch a state whose marketplace law would force the platform to collect.
8. **Idempotency everywhere.** Use Stripe idempotency keys, unique DB constraints and deduped webhooks. A repeated event must never double-charge, double-refund or double-pay.
9. **Sandbox only during development.** Never use or print `sk_live_` keys. Never read or echo `.env` files. Secrets come from the environment.
10. **Tests must pass** (`npm test`) before a change is done. Add tests for every new money path.

## Stripe

- Use the Stripe MCP server (`.mcp.json` → `https://mcp.stripe.com`; sign in via browser on first use) for looking things up in the **sandbox**: accounts, events, payments. Don't make live-mode changes through it.
- Use the Stripe CLI for webhooks: `stripe listen …` (see `npm run stripe:listen`) and `stripe trigger payment_intent.succeeded --stripe-account acct_…`.
- Some Dashboard settings can only be done by a person (Connect setup, branding, Billing retries, activation). Don't try to automate them; they are listed in `docs/STRIPE_DASHBOARD_CHECKLIST.md`.
- Some answers we still need from Stripe in writing are listed in `services/payments/README.md` → "Needs Stripe's written confirmation". Don't treat those assumptions as settled.

## Style

- Explain money changes with a worked example in cents (like the brief's $30 / $10 tables).
- Keep pure money logic in `src/core/` (no I/O) and side effects in `src/payments/`.
- Plain, specific names; no abbreviations for business terms.
