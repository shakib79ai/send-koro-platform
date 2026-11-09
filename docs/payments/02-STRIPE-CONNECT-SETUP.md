# 2. Stripe Connect setup

Code: `services/payments/src/payments/onboarding.service.ts`, `connect-dashboard.service.ts`, `src/webhooks/`, `scripts/stripe-setup.ts`. Person-only steps: `docs/STRIPE_DASHBOARD_CHECKLIST.md`.

## 2.1 Platform configuration (Dashboard, done by a person)

| Setting | Choice | Why |
|---|---|---|
| Business type | Platform or marketplace | |
| Charge type | **Direct charges** | Food money goes straight to each restaurant |
| Connect pricing | **Stripe handles pricing for your users** | Restaurants pay Stripe directly; no per-account fees for Send Koro |
| Fees | `fees_collector = stripe` | Stripe takes processing fees from the connected account |
| Losses | `losses_collector = stripe` | Stripe owns unrecoverable connected-account losses |
| Connected-account Dashboard | **Full Stripe Dashboard** | Restaurants and drivers manage their own Stripe accounts |
| Onboarding | Stripe-hosted, **Accounts v2** | |
| Payment methods | Cards, Apple Pay, Google Pay, Link | Domain `sendkoro.com` |
| Stripe Tax | Off for orders | Restaurants handle their own sales tax |
| Billing | Pay-as-you-go (0.7% of subscription volume) | For restaurant plans |
| Branding | Send Koro icon, navy `#0B3B6E`, red `#E3242B` | Shown on hosted onboarding |

Platform account: `acct_1UVa9IQzpvBKCndf`. API version pinned in `src/stripe/stripe.client.ts`: `2026-08-26.dahlia`, SDK `stripe@22.6.2`.

## 2.2 Keys and environment (payments service)

Secrets come from the environment only. Never commit, read aloud or echo `.env`.

| Variable | Example / meaning |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` while developing; a **restricted key** in production (scopes in the checklist) |
| `STRIPE_PUBLISHABLE_KEY` | `pk_test_…` |
| `STRIPE_PLATFORM_ACCOUNT_ID` | `acct_1UVa9IQzpvBKCndf` (the setup script warns if the key belongs to another account; sandboxes have their own IDs) |
| `STRIPE_WEBHOOK_SECRET` | platform endpoint signing secret |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | connected-accounts endpoint signing secret |
| `STRIPE_THIN_EVENTS_SECRET` | Accounts v2 event destination secret |
| `PUBLIC_BASE_URL` | public https URL of the payments service (tunnel URL in development) |
| `RESTAURANT_PORTAL_URL`, `DRIVER_APP_URL` | onboarding return/refresh pages |
| `PAYMENT_METHOD_DOMAIN` | `sendkoro.com` |
| `INTERNAL_API_KEY` | shared key for the core API → payments calls (placeholder for real service auth) |
| `EST_STRIPE_FEE_BPS`, `EST_STRIPE_FEE_FIXED_CENTS` | 290, 30 |
| `OWN_DRIVER_PAYOUT_FEE_BPS/_CENTS`, `THIRD_PARTY_PAYMENT_FEE_BPS/_CENTS` | 25, 25 until Stripe confirms |
| `FIRST_MONTH_FREE` | `true` |

Apps: the restaurant portal needs `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (build argument) for the Stripe tab; the customer web/app need the publishable key for Stripe.js and the payment sheet.

## 2.3 Restaurant connected account (Built)

One Accounts v2 account per restaurant (or per location that uses its own account):

```ts
stripe.v2.core.accounts.create({
  display_name, contact_email, dashboard: 'full', identity: { country: 'us' },
  defaults: { currency: 'usd', locales: ['en-US'],
    responsibilities: { fees_collector: 'stripe', losses_collector: 'stripe' } },
  configuration: {
    merchant: { capabilities: { card_payments: { requested: true } } },  // takes the direct charges
    customer: {},                                                          // so Billing can charge the plan via customer_account
  },
  metadata: { send_koro_type: 'restaurant', send_koro_restaurant_id },
}, { idempotencyKey: `restaurant-account:${restaurantId}` });
```

- Onboarding link: `v2.core.accountLinks.create` with `configurations: ['merchant', 'customer']`, return `…/payouts/stripe/return`, refresh `…/payouts/stripe/refresh` (both pages exist in `apps/restaurant-web`).
- Ready when `configuration.merchant.capabilities.card_payments.status === 'active'`. Then `ensurePaymentMethodDomain` registers `sendkoro.com` on the account (needed for Apple Pay / Google Pay on direct charges).
- **Per-location accounts** (business model, 5 Nov): a location may use its own connected account. **Partly built:** the schema has one `stripe_account_id` per restaurant record; give each location its own record in the payments registry when it needs its own account.
- **To build for promo credit pay-back:** sending excess credit to a restaurant needs a transfer to its account. Check whether a merchant-configured v2 account can receive platform transfers; if not, also request `configuration.recipient` (`stripe_balance.stripe_transfers`) during onboarding. **Needs confirmation.**

## 2.4 Own-driver connected account (Built)

```ts
stripe.v2.core.accounts.create({
  display_name, contact_email, dashboard: 'full', identity: { country: 'us', entity_type: 'individual' },
  defaults: { currency: 'usd', locales: ['en-US'],
    responsibilities: { fees_collector: 'stripe', losses_collector: 'stripe' } },
  configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
  metadata: { send_koro_type: 'driver', send_koro_driver_id },
}, { idempotencyKey: `driver-account:${driverId}` });
```

- Onboarding link with `configurations: ['recipient']`. Stripe verifies identity and bank and collects W-9-style tax details.
- Ready when `configuration.recipient.capabilities.stripe_balance.stripe_transfers.status === 'active'`.
- **Needs confirmation:** that recipient-only accounts may use `fees_collector = stripe` and the full Dashboard. If Stripe says no, switch drivers to `application` and book payout costs as delivery costs.

## 2.5 Keeping status in sync (Built)

`OnboardingService.syncAccount(accountId)` reads the v2 account and sets `onboarding_status` to `active`, `restricted` (something currently due or past due) or `pending`. It runs:

- on the return page (`POST /stripe/accounts/:acct/sync`), and
- on every Accounts v2 thin event (`v2.core.account[...].capability_status_updated`, `v2.core.account[requirements].updated`).

## 2.6 Webhooks (Built)

Three endpoints, all signature-verified and deduplicated in `stripe_events` (a repeated event never repeats money):

| Endpoint | Secret | Events |
|---|---|---|
| `/webhooks/stripe` (platform) | `STRIPE_WEBHOOK_SECRET` | `application_fee.created`, `application_fee.refunded`, `transfer.created`, `transfer.reversed`, `balance.available`, `invoice.created`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`, `checkout.session.completed` |
| `/webhooks/stripe/connect` (connected accounts) | `STRIPE_CONNECT_WEBHOOK_SECRET` | `payment_intent.amount_capturable_updated`, `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded`, `refund.updated`, `charge.dispute.created`, `charge.dispute.closed`, `payout.paid`, `payout.failed` |
| `/webhooks/stripe/v2` (Accounts v2, thin) | `STRIPE_THIN_EVENTS_SECRET` | the four `v2.core.account[...]` events above |

`npm run stripe:setup` creates all three and prints the secrets once. Locally:

```bash
stripe listen --forward-to localhost:3000/webhooks/stripe --forward-connect-to localhost:3000/webhooks/stripe/connect
stripe trigger payment_intent.succeeded --stripe-account acct_<test restaurant>
```

## 2.7 The Stripe tab in the apps (Built)

Account sessions for Stripe's Connect embedded components, plus an overview Send Koro builds (`ConnectDashboardService`):

| Endpoint (payments) | Core API (apps call this) | Who |
|---|---|---|
| `POST /restaurants/:id/stripe/account-session` | `POST /v1/restaurants/:id/stripe/account-session` | restaurant **owner only** |
| `GET /restaurants/:id/stripe/overview` | `GET /v1/restaurants/:id/stripe/overview` | restaurant owner only |
| `POST /drivers/:id/stripe/account-session` | `POST /v1/driver/stripe/account-session` | the driver |
| `GET /drivers/:id/stripe/overview` | `GET /v1/driver/stripe/overview` | the driver |

Embedded component rules (`src/core/connect.ts`, tested):

- **Restaurants:** onboarding, account management, notification banner, balances, payouts, payouts list, payout details, documents, payments, payment details, disputes. **Refunds and capture are off** in the payments components (refunds go through Send Koro; capture happens on accept). Disputes allowed. Instant payouts off. Restaurants may edit their payout schedule.
- **Drivers:** the same without any payments components; payout schedule not editable from Send Koro; instant payouts off.
- Full-Dashboard accounts always ask the user to sign in to Stripe for sensitive changes; this can't be switched off.

Restaurant portal page: `apps/restaurant-web/app/stripe/page.tsx` (`@stripe/connect-js` 3.4.6, pure loader). Driver app: `apps/driver-app/lib/screens/stripe.dart` (native screens + "Open Stripe Dashboard", because embedded components are web only).

## 2.8 Test data (sandbox)

SSN `000-00-0000`, date of birth `01/01/1901`, phone `000 000 0000`, routing `110000000`, account `000123456789`, card `4242 4242 4242 4242`.

## 2.9 Needs Stripe's written confirmation

1. Direct charges with `fees_collector = stripe`, `losses_collector = stripe` and the full Dashboard for restaurants.
2. `application_fee_amount` carrying the delivery money (including the restaurant's share) plus the full tip, less the delivery's processing-fee share.
3. Recipient-only driver accounts with Stripe-collected fees and the full Dashboard.
4. Platform-to-driver transfers funded from application-fee receipts.
5. Send Koro's branded marketplace presentation with the restaurant as merchant.
6. Billing via `customer_account` for Accounts v2 restaurants.
7. The fee schedule, including payout fees.
8. **New:** a direct charge lowered by platform-funded promo credit, with the platform paying the difference back later (document 5).
9. **New:** saved cards: saving a card once on the platform and cloning it to each restaurant's account for direct charges.
