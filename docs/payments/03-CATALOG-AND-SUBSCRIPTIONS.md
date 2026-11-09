# 3. Catalog and restaurant subscriptions

Code: `services/payments/src/core/tiers.ts`, `src/payments/subscriptions.service.ts`, `src/jobs/payments.jobs.ts`, `scripts/stripe-setup.ts`, `scripts/run-tier-job.ts`. Slash command: `/tier-job 2026-10`.

Restaurants pay **$0 commission** and a flat monthly plan. Drivers pay nothing; nothing is created in Stripe for drivers.

## 3.1 The plan (business model)

Each location's plan comes from **that location's** net food sales in the previous calendar month, New York time.

- **Net food sales** = food after the restaurant's discounts, minus food refunds. Tips, tax, delivery fees, service charges and Send Koro promo credit are **not** counted (credit doesn't lower food sales).
- **Tiers** (`RESTAURANT_TIER_RULE_VERSION = restaurant-2026-11-v1`):

| Net food sales last month | Plan | Price lookup key |
|---|---|---|
| up to $2,500.00 | $50 | `restaurant_tier_1` … |
| $2,500.01 – $5,000.00 | $100 | |
| $5,000.01 – $7,500.00 | $150 | |
| $7,500.01 – $10,000.00 | $250 | |
| $10,000.01 – $15,000.00 | $350 | |
| over $15,000.00 | $500 | `restaurant_tier_6` |

(Exact lookup keys: `RESTAURANT_TIERS` in `tiers.ts`.)

- A new location's first month is free; locations that aren't live aren't billed; zero or negative months pay the lowest plan.
- Billed on the 1st at **12:00 ET**, no proration. Late refunds count in the month they're processed.
- All locations of one owner are billed on **one invoice, one line per location**.

## 3.2 Stripe catalog (Built: `npm run stripe:setup`)

- Product `sk_restaurant_subscription` — "Send Koro Restaurant Subscription", tax code `txcd_10103001` (SaaS, business use).
- Six monthly USD prices, one per tier, found by `lookup_key`, `tax_behavior: exclusive`, metadata `tier_up_to_cents`.
- Prices are immutable: to change a tier price, the script creates a new price and moves the lookup key (`transfer_lookup_key: true`). Code always finds prices by lookup key, never by hard-coded ID.
- Billing customer portal configuration (payment method update and invoice history on, cancellation off).

## 3.3 How billing works today (Built)

1. `POST /restaurants/:id/subscription/payment-method` → Checkout Session in `setup` mode with `customer_account = <restaurant acct>`, card or US bank account.
2. `POST /restaurants/:id/subscription` → `subscriptions.create` with `customer_account`, the lowest tier price, `trial_end` at the next renewal anchor (first month free) or `billing_cycle_anchor` at that time, idempotency key `restaurant-sub:{restaurantId}`.
3. **Month-end tier job**, 00:30 ET on the 1st (`@Cron('30 0 1 * *')`): for each subscription, total last month's net food sales from the ledger, pick the tier, switch the price with `proration_behavior: 'none'` (idempotency key `tier:{restaurantId}:{period}`) and store a `tier_snapshots` row (one per restaurant per period, unique).
4. **Safety net** on `invoice.created` (`billing_reason = subscription_cycle`): if there's no snapshot or the price doesn't match, pause the invoice (`auto_advance: false`) and alert.
5. Dashboard settings (person): Smart Retries, 4 tries over 2 weeks, then mark the subscription **unpaid** (not cancelled); email customers about failed payments.

## 3.4 Gap: one line per location (To build)

Today there is **one subscription with one price per restaurant record**. The business model needs one invoice with **a line per location**, each priced from that location's own sales. Stripe doesn't allow two items with the same price in one subscription, so don't model locations as subscription items.

**Design to build:**

- Keep one subscription per billing owner on a **$0 monthly price** (`sk_restaurant_plan_base`, lookup key `restaurant_plan_base`). It provides the billing cycle, retries, the portal and the invoice.
- In the month-end job, for each **live** location, add a pending **invoice item** to that subscription's upcoming invoice:
  - `invoiceItems.create({ customer_account, subscription, currency: 'usd', amount: tierPrice, description: "Park Slope · October net food sales $6,240.00 · plan $150", metadata: { location_id, period, tier_rule } }, { idempotencyKey: \`plan-line:${locationId}:${period}\` })`
  - First free month: amount 0 with the description "Park Slope · first month free".
- Store one `tier_snapshots` row per **location** per period (change the unique index to location + period).
- Update the `invoice.created` safety net to check that every live location has a line.
- Tests: two locations in different tiers → one invoice with two lines; re-running the job adds nothing; a location that went live mid-month gets a free line.

## 3.5 Lines Send Koro adds to the plan invoice (To build)

Run in the same month-end job, after the plan lines, all as invoice items on the same upcoming invoice:

| Line | Amount | Source |
|---|---|---|
| Send Koro promo credit — paid back | **negative**: credit customers used at that location last month (see document 5) | `credit_reimbursements` |
| Processing fee owed to you | negative: `fee_share_owed_to_restaurant` from refunds | refunds ledger |

- Never let the invoice go below $0. If the credits are larger than the plan lines, put only the plan total on the invoice and **transfer the rest** to the restaurant's Stripe account in the same run (`transfers.create`, idempotency key `credit-excess:{locationId}:{period}`). Decided 9 Nov 2026.
- Worked example: Park Slope plan $150.00; October promo credit used $15.00 → invoice $150.00 − $15.00 = **$135.00**. Dhaka Kitchen plan $350.00, credit $50.00 → $300.00. A location with a $50.00 plan and $80.00 of credit → invoice line −$50.00 (invoice $0.00) and a $30.00 transfer.

## 3.6 Restaurant portal (prototype done; app To build)

Subscription page: this month's total, next bill estimate, plan by location, invoices (with the promo credit line), a "Send Koro promo credit this month" card listing the orders, billing card and email, fee calculator and tier table.

## 3.7 Endpoints

| Payments service | Purpose |
|---|---|
| `POST /restaurants/:id/subscription/payment-method` | hosted page to save the billing card or bank |
| `POST /restaurants/:id/subscription` | create the subscription (idempotent) |
| `GET /billing` | admin billing overview |
| job / `scripts/run-tier-job.ts` | month-end tier job (dry-run with `/tier-job`) |
