# 4. Driver and courier pay

Code: `services/payments/src/payments/settlement.service.ts`, `src/core/allocation.ts` (`priceDelivery`), `services/api/src/core/batching.ts`, `services/api/src/core/rate-card.ts`, `services/api/src/drivers/`.

## 4.1 One delivery price for every courier (Built)

The delivery fee D is built from the courier price P (the Uber Direct quote, about $7.80 on average), whoever delivers:

```
D = P + payout cost + card cost              (document 1, §1.3)
application fee after the card share = P + T + payout cost
```

So whether Uber Direct, DoorDash Drive or Send Koro's own driver delivers, the courier gets **P + 100% of the tip**, and Send Koro breaks even on the delivery money.

## 4.2 Own drivers (Built)

| Rule | Detail |
|---|---|
| Pay | **Locked pay = P** (= delivery fee − card share − payout cost). Example: $8.48 − 39¢ − 29¢ = **$7.80**. Fixed when the driver accepts the offer (`deliveries.driver_pay_cents`); nothing may lower it later. |
| Tip | 100% of the tip, on top. Never used to meet the minimum, never reduced. |
| Batching | Two orders on one route: the driver gets each order's own amount, e.g. $7.80 + $6.50 = $14.30. |
| Fallback | Rate card $2.50 + 45¢/min + 75¢/mi, only for an order with no stored courier price. |
| Fees | None. No driver subscription, no fee lines on statements. |
| What the driver sees | Distance, time, pickup, bridges/tunnels, locked pay and tip before accepting; never D, the card share or the payout cost. |

**Transfer on delivery** (`POST /fulfilment/:orderId/own-driver-delivered`):

```ts
stripe.transfers.create({ amount: lockedPay + tip, currency: 'usd', destination: driverAcct,
  transfer_group: orderId, metadata: { order_id, pay_cents, tip_cents } },
  { idempotencyKey: `driver-transfer:${orderId}` });
```

- One row per order in `driver_transfers` (unique `idempotency_key`).
- Statuses: `pending` → `processing` → `paid`; `owed` when the driver's account isn't active yet or the platform's **available** balance is too low (application fees aren't instantly available); `on_hold` while a dispute is open; `failed`; `reversed`.
- `retryOwed()` every 15 minutes (`@Cron('*/15 * * * *')`) and `POST /driver-settlements/retry`.
- `charge.dispute.created` puts the order's transfer on hold; it's released when the dispute closes.

Example statement line: "SK1052 · locked pay $7.80 · tip $5.40 · $13.20".

## 4.3 NYC minimum pay (Built)

- $22.13 per hour of trip time (standard method). Every **Monday 06:00 ET** the core API totals each driver's last week (trip seconds and locked pay) and calls `POST /drivers/:id/nyc-top-ups`.
- Top-up = max(0, ceil(trip seconds × $22.13 ÷ 3600) − locked pay). Tips don't count.
- One top-up per driver per week (`driver_top_ups`, unique driver + week), transferred with idempotency key `nyc-top-up:{driverId}:{weekStart}`.
- Example: 2 h 40 min of trips = 9,600 s → minimum $59.02; locked pay $55.20 → top-up **$3.82**.

## 4.4 When drivers get the money

- Each order's pay + tip reaches the driver's Stripe balance after delivery (once the platform balance is available).
- NYC top-ups arrive on Monday.
- Stripe pays the driver's bank on the **driver account's own payout schedule**. Send Koro can't force a schedule on full-Dashboard accounts. Instant payouts are off at launch.
- Driver app → Stripe tab: weekly statements (`weeklyStatement` in `src/core/connect.ts`), balance, schedule, bank, payouts, "Open Stripe Dashboard".

## 4.5 Taxes for drivers

Send Koro is the payer and issues a **1099-NEC** to each driver paid $2,000 or more in a year (2026 threshold), covering locked pay, tips and NYC top-ups, through Stripe's 1099 product. Stripe doesn't issue 1099-Ks to drivers.

## 4.6 Third-party couriers: Uber Direct and DoorDash Drive (Built)

- Paid **by their invoice**, not through Stripe Connect.
- On assignment, `POST /fulfilment/:orderId/supplier-assigned` stores a `supplier_obligations` row (provider, delivery ID, quote, tip) and returns the tip to send in the provider's **tip field** (100% pass-through; DoorDash requires it).
- `POST /fulfilment/:orderId/supplier-tip-submitted` marks the tip sent.
- When the provider's invoice arrives, `POST /supplier-obligations/:orderId/reconcile` with the billed amount and tip; mismatches are flagged for admin.
- The payout cost on these orders covers Send Koro paying the provider from its bank.
- Provider names appear only in admin. Customers and restaurants see "Delivery fee".

## 4.7 Cancellations (open decision)

The refund policy when a cancelled order's driver or provider has already been paid is still open (`BUSINESS_MODEL.md` → Open decisions). Until decided: never reverse a driver transfer automatically; flag the order for admin.

## 4.8 Endpoints

| Payments service | Purpose |
|---|---|
| `POST /fulfilment/:orderId/own-driver-delivered` | pay the driver (once) |
| `POST /driver-settlements/retry` | retry `owed` transfers |
| `GET /driver-settlements` | admin list |
| `POST /drivers/:id/nyc-top-ups` | weekly top-up |
| `GET /drivers/:id/payouts`, `GET /drivers/:id/stripe/overview` | driver app |
| `POST /fulfilment/:orderId/supplier-assigned`, `/supplier-tip-submitted` | third-party courier |
| `GET /supplier-obligations`, `POST /supplier-obligations/:orderId/reconcile` | invoice reconciliation |
