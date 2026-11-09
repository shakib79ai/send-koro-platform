# Send Koro payments — developer documents

These documents explain how money moves in Send Koro and how to set up and build the Stripe side. They are written for developers and for Claude Code. They follow `docs/BUSINESS_MODEL.md` (the source of truth for business rules) and replace the parts of `docs/STRIPE_TECHNICAL_BRIEF.md` (v1.2) that the business model has since changed.

**Reading order**

| # | Document | Read it when you… |
|---|---|---|
| 1 | [01-MONEY-MODEL.md](01-MONEY-MODEL.md) | need to know who pays what on an order, with worked examples in cents |
| 2 | [02-STRIPE-CONNECT-SETUP.md](02-STRIPE-CONNECT-SETUP.md) | set up the Stripe platform, connected accounts, onboarding, webhooks, keys and the Stripe tab |
| 3 | [03-CATALOG-AND-SUBSCRIPTIONS.md](03-CATALOG-AND-SUBSCRIPTIONS.md) | work on restaurant plans: Stripe products, prices, the monthly tier job and invoices |
| 4 | [04-DRIVER-AND-COURIER-PAY.md](04-DRIVER-AND-COURIER-PAY.md) | work on paying own drivers, NYC minimum pay, Uber Direct and DoorDash Drive |
| 5 | [05-CREDIT-REFERRAL-WALLET.md](05-CREDIT-REFERRAL-WALLET.md) | build the wallet, promo codes, the referral program and paying restaurants back |
| 6 | [06-CLAUDE-CODE-RUNBOOK.md](06-CLAUDE-CODE-RUNBOOK.md) | are Claude Code (or a developer) and need step-by-step tasks, commands and checks |

**Status labels used in every document**

- **Built:** in the code today and covered by tests (`npm test`).
- **Partly built:** some of it is in the code; the gap is described.
- **To build:** decided in the business model, not in the code yet.
- **Needs confirmation:** waits for Stripe's (or a lawyer's) written answer. Don't treat these as settled.

**Rules that apply everywhere** (from the root `CLAUDE.md`)

1. Money is integer cents. No floats.
2. Direct charges on the restaurant's account. Never a platform charge with `transfer_data` for food money.
3. `application_fee_amount = D + T − delivery fee share`. It is a delivery fulfilment allocation, never a food commission.
4. Customers never see the courier company and never pay a card processing fee.
5. Drivers' locked pay and tips are never reduced; 100% of every tip goes to the courier; no driver fees or subscription.
6. Send Koro never collects, files or pays sales tax.
7. Idempotency everywhere: Stripe idempotency keys from our own IDs, unique database constraints, deduplicated webhooks.
8. Sandbox only while developing. Never use or print `sk_live_` keys; never read or echo `.env` files.
9. `npm test` passes before a change is done; every new money path gets tests.
