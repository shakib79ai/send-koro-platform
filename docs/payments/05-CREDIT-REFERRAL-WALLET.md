# 5. Send Koro credit: wallet, promo codes, referrals, paying restaurants back

Status: **To build** in the backend. The customer, restaurant and admin prototypes show the finished behaviour (customer: Wallet, Refer a friend, sign-up code, checkout credit toggle; restaurant: credit lines on orders, invoice line, subscription card; admin: Customer credit page). Rules: `docs/BUSINESS_MODEL.md` → Referral program and promo credit.

## 5.1 Rules (business model)

| Rule | Value (admin can change) |
|---|---|
| Who can earn or use credit | Customers with a **verified phone number** only |
| Referral reward | Friend gets **$5.00** when they sign up with the code; referrer gets **$5.00** after the friend's **first completed order** (admin setting `when = firstOrder`) |
| Promo codes | Admin-made codes, e.g. `WELCOME10` = $10.00, `BROOKLYN5` = $5.00; one use per customer |
| Expiry | Each credit expires **30 days** after it's granted; the oldest credit is used first |
| Where it can be used | Only at checkout, on an order; never cash, never transferable, never on tips |
| What it covers | Food + tax only; at least **50¢** stays on the card |
| Limit | Referral rewards per referrer per month: 10 (admin) |
| Who pays | **Send Koro**, always. The restaurant gets its full price; the courier gets full pay + tip |
| Restaurant pay-back | Monthly, as a negative line on the restaurant's plan invoice; anything above the plan is sent to the restaurant's Stripe account in the same run |

Credit is a platform promotion. It **doesn't lower net food sales** (the plan tier uses food before credit) and isn't a restaurant discount.

## 5.2 How credit works with direct charges

The order is still one direct charge on the restaurant's account. Credit lowers the card charge; Send Koro pays the restaurant the difference later.

```
Q_card = Q − credit                 (the card charge on the restaurant's account)
application_fee_amount = A − delivery fee share(Q_card)    (unchanged rule, fee share computed on Q_card)
restaurant is owed `credit` by Send Koro  → credit_reimbursements row
```

**Maximum credit** on an order (refines "food + tax − 50¢" so the application fee and Stripe's fee always fit inside the card charge):

```
credit ≤ min(wallet balance, F + X − 50, Q − A − estimated Stripe fee(Q) − 50)
```

**Worked example** (split case from document 1: Q 4354, A 1388, application fee 1349, Stripe fee 157):

| | No credit | $5.00 credit |
|---|---|---|
| Card charge Q_card | 4354 | **3854** |
| Customer's receipt | Total $43.54 | Total $43.54, Send Koro credit (promo) −$5.00, **Card total $38.54** |
| Application fee (delivery + tip − its fee share) | 1349 | about 1348–1349 (fee share recomputed on 3854) |
| Restaurant receives now | 2848 | about 2348 |
| Send Koro pays back on the next invoice | — | **500** |
| Restaurant's final money | 2848 | 2848 (within 1¢; see note) |
| Courier gets | 1320 | 1320 |

Note: a lower card charge means a slightly lower Stripe fee, so the delivery fee share can move by about 1¢. `priceDelivery` must take the credit into account (price D on `Q_card`) so the application fee still equals P + T + payout cost exactly. Add a test that proves this for credits of 1¢, 500 and the maximum.

Max credit here: min(balance, 3266 − 50, 4354 − 1388 − 157 − 50 = 2759) → 2759.

## 5.3 Tables (payments service owns the money; core API owns codes and invites)

Payments service (new migration, `/new-migration wallet_credit`):

| Table | Key columns | Constraints |
|---|---|---|
| `wallet_credits` | id, customer_id, source (`referral_friend`, `referral_referrer`, `promo_code`, `admin`, `refund_return`), amount_cents, remaining_cents, granted_at, expires_at, source_ref | unique (source, source_ref) so a grant can't repeat |
| `wallet_debits` | id, order_id, credit_id, amount_cents, created_at, reversed_at | unique (order_id, credit_id) |
| `credit_reimbursements` | id, order_id, location_id, amount_cents, period (YYYY-MM), status (`pending`, `invoiced`, `transferred`, `cancelled`), invoice_item_id, transfer_id | unique order_id |

Core API:

| Table | Key columns | Constraints |
|---|---|---|
| `referral_codes` | customer_id, code (e.g. `SHAKIB5`) | unique code, unique customer |
| `referrals` | referrer_id, friend_id, code, status (`signed_up`, `rewarded`, `blocked`), friend_credit_id, referrer_credit_id | unique friend_id (a person is referred once) |
| `promo_codes` | code, amount_cents, active, starts_at, ends_at, max_redemptions | unique code |
| `promo_redemptions` | code, customer_id, credit_id | unique (code, customer_id) |
| `credit_settings` | on, referrer_cents, friend_cents, days, when, per_month, min_card_cents | single row, audited |

Balance = sum of `remaining_cents` on unexpired credits. Store integers only.

## 5.4 Flows

**Sign-up with a code** (API): verify the phone → look up the code → referral code: create `referrals` row and grant the friend's credit; promo code: create `promo_redemptions` and grant. Grants call payments `POST /customers/:id/wallet/credits` with idempotency key `grant:{source}:{source_ref}`.

**Referrer reward:** on the friend's first `delivered` order, the API marks the referral `rewarded` and grants the referrer's credit (`source_ref = referral id`), unless the monthly limit is reached.

**Quote and payment:** `POST /checkout/quotes` takes `use_credit: true`; the quote stores `credit_cents` (worked out with §5.2). On `POST /checkout/quotes/:id/payment`, the PaymentIntent amount is `Q − credit`; the `wallet_debits` rows are written **in the same transaction** that reserves the credit (oldest first). If the payment is cancelled or declined, the debits are reversed.

**Capture:** when the restaurant accepts, create the `credit_reimbursements` row (`pending`, period = the order's New York month).

**Refunds:**
- Full refund: return the credit to the wallet as a new `refund_return` credit with a fresh 30 days (or the original expiry — **decide**; default fresh 30 days), refund the card part on Stripe, cancel the reimbursement.
- Partial refund: refund the card first, then credit; reduce the reimbursement by the credit part returned.

**Month-end** (inside the tier job, document 3 §3.5): sum `pending` reimbursements per location for last month → negative invoice item "Send Koro promo credit — paid back" (idempotency key `credit-line:{locationId}:{period}`), capped at that location's plan lines → mark `invoiced`. Any remainder → `transfers.create` to the restaurant's account (idempotency key `credit-excess:{locationId}:{period}`) → mark `transferred`. (Transfer capability: document 2 §2.3, needs confirmation.)

## 5.5 Fraud checks

- Phone verified before any grant; one referral per phone number and per card fingerprint.
- Referrer and friend can't share a phone, card fingerprint or delivery address.
- Monthly reward cap; admin can block a referral (status `blocked`) before the reward.
- Credit can't be used on an order whose card total would be under 50¢.

## 5.6 Endpoints to build

| Service | Endpoint | Purpose |
|---|---|---|
| Payments | `GET /customers/:id/wallet` | balance, credits with expiry, history |
| Payments | `POST /customers/:id/wallet/credits` | grant (internal, idempotent) |
| Payments | `GET /credit-reimbursements?period=` | admin reconciliation table |
| API | `GET /v1/me/wallet`, `POST /v1/me/wallet/promo` | customer wallet, apply a promo code |
| API | `GET /v1/me/referral` | code, link, invited friends, rewards |
| API | `GET/PUT /v1/admin/credit-settings`, `GET/POST/PATCH /v1/admin/promo-codes` | admin |
| API | `GET /v1/restaurants/:id/promo-credit?period=` | restaurant's "promo credit this month" card |

## 5.7 Tests to add (required: these are money paths)

1. Max credit never lets the card charge drop below `application fee + Stripe fee + 50`.
2. With credit, the application fee still equals P + T + payout cost.
3. Granting twice with the same source ref creates one credit.
4. Expired credit isn't used; the oldest credit is used first.
5. Declined order returns the credit; full refund returns it and cancels the reimbursement.
6. Month-end: plan $150 and $15 credit → invoice line −$15; plan $50 and $80 credit → line −$50 and a $30 transfer; re-running adds nothing.
7. Net food sales for the tier are the same with or without credit.
