# 1. Money model: who pays what

Source of truth: `docs/BUSINESS_MODEL.md`. Code: `services/payments/src/core/allocation.ts` (pure, no I/O).

## 1.1 The parties

| Party | Has a Stripe account? | Receives | Pays |
|---|---|---|---|
| **Customer** | No (card, Apple Pay, Google Pay, Link) | Food, delivery | Food + tax + its part of the delivery fee + tip, minus any Send Koro credit |
| **Restaurant (each location)** | Yes, a connected account with the full Stripe Dashboard | Food + tax + service charges, directly | Stripe's processing fee on its part, its chosen delivery share, a monthly plan. **$0 commission.** |
| **Send Koro (platform)** | Platform account `acct_1UVa9IQzpvBKCndf` | The application fee (delivery money + tip), monthly plans | Own drivers, Uber Direct / DoorDash Drive invoices, payout costs, promo credit |
| **Own driver** | Yes, a connected account (recipient) with the full Dashboard | Locked pay + 100% of the tip, NYC top-ups | Nothing. No fees, no subscription. |
| **Uber Direct / DoorDash Drive** | No (paid by invoice) | Their quote + 100% of the tip | — |

## 1.2 Letters used in formulas (all integer cents)

| Letter | Meaning |
|---|---|
| F | Food subtotal after the restaurant's own discounts, before tax |
| S | Restaurant service charges and extra fees |
| X | Sales tax, set by the restaurant, paid to the restaurant |
| T | Courier tip (100% to the courier) |
| P | Courier price: the Uber Direct quote (also used for own drivers) |
| D | Delivery price shown as "Delivery fee" |
| R | Restaurant's delivery share (from its delivery rule) |
| C | Customer's delivery share, C = D − R |
| Q | The card charge on the restaurant's account |
| A | The application fee before the processing-fee adjustment |

```
Q = F + S + X + C + T
A = D + T
restaurant keeps before Stripe's fee = F + S + X − R      (= Q − A)
C + R = D, 0 ≤ R ≤ D
```

## 1.3 The delivery price D (Built)

Send Koro adds no service fee, no small-order fee, no surge fee and no distance fee. The delivery fee only covers the courier and the costs the delivery money itself causes:

```
payout cost = ceil((P + T) × 25 / 10000) + 25        (0.25% + 25¢; env OWN_DRIVER_PAYOUT_FEE_* / THIRD_PARTY_PAYMENT_FEE_*)
card cost   = the delivery money's share of Stripe's fee on Q
D           = the smallest D with D ≥ P + payout cost + card cost      (priceDelivery)
```

After the processing-fee adjustment, the application fee equals **P + T + payout cost** exactly. So the courier gets their full price and the full tip, and Send Koro breaks even on delivery.

## 1.4 Processing fees (Built)

Stripe charges its fee (2.9% + 30¢ standard) on the whole direct charge Q, and takes it from the restaurant's account. The delivery money pays its own share:

```
delivery fee share = round(StripeFee(Q) × (C + T) ÷ Q)
application_fee_amount = A − delivery fee share           (applicationFeeAfterShare)
```

- Set provisionally when the PaymentIntent is created (domestic-card estimate), then **recomputed at capture from the real card** (international cards cost more).
- Never taken from a driver's pay or tip.
- Customers never see a card fee.

## 1.5 Worked example (numbers produced by the real code)

Food $30.00, tax 8.875% = $2.66, tip $5.40, courier price P $7.80, Stripe 2.9% + 30¢, payout cost 0.25% + 25¢.

| | Restaurant pays $3 (split) | Customer pays all | Restaurant pays all |
|---|---|---|---|
| D (Delivery fee) | 848 | 859 | 829 |
| R / C | 300 / 548 | 0 / 859 | 829 / 0 |
| **Q (card charge)** | **4354** | 4665 | 3806 |
| A = D + T | 1388 | 1399 | 1369 |
| Stripe fee on Q | 157 | 166 | 141 |
| Delivery fee share | 39 | 50 | 20 |
| **Application fee** | **1349** | 1349 | 1349 |
| Restaurant keeps (Q − app fee − Stripe fee) | 4354 − 1349 − 157 = **2848** | 3150 | 2316 |
| Own driver gets | 780 + 540 = **1320** | 1320 | 1320 |
| Send Koro keeps for the payout cost | 29 | 29 | 29 |

Check (split case): restaurant 2848 = F + X − R − its share of the fee = 3000 + 266 − 300 − (157 − 39). The customer's receipt shows Food $30.00, Delivery fee $8.48, "Brooklyn Bowl Co. pays part" −$3.00, Tax $2.66, Courier tip $5.40, **Total $43.54**.

## 1.6 Order lifecycle (Built)

| Step | Payments service call | Stripe |
|---|---|---|
| Quote | `POST /checkout/quotes` | none; freezes F, S, X, D, C, R, T against the restaurant's current delivery consent |
| Pay | `POST /checkout/quotes/:id/payment` | `paymentIntents.create` **on the restaurant account** (`stripeAccount`), `amount = Q`, `application_fee_amount = A − share`, `capture_method = manual` |
| Restaurant accepts | `POST /orders/:id/accept` | capture with the final application fee |
| Declined or 5 minutes pass | `POST /orders/:id/decline` | cancel the authorisation; the customer is never charged |
| Own driver delivered | `POST /fulfilment/:orderId/own-driver-delivered` | `transfers.create` to the driver: locked pay + full tip, once |
| Third-party courier | `POST /fulfilment/:orderId/supplier-assigned` | none; records the obligation and the tip to send |
| Refund | `POST /orders/:id/refunds` | refund on the restaurant's charge + `applicationFees.createRefund` for the delivery part |

Frontend: Stripe.js must use the restaurant's account for direct charges:

```js
const stripe = Stripe(PUBLISHABLE_KEY, { stripeAccount: res.stripeAccount });
```

## 1.7 Refunds (Built)

- Refunded by component: food, service charge, tax, customer delivery, subsidy restoration, tip (`src/core/refunds.ts`).
- The delivery part is returned with an application-fee refund, capped at what was actually taken.
- Stripe keeps its processing fee on refunds. The delivery's share of that lost fee is recorded as `fee_share_owed_to_restaurant` (crediting it on the next plan invoice is **To build**, see document 3).

## 1.8 Sales tax, service charges, promotions

- **Sales tax:** the restaurant sets the rate (stored in parts per million, 88750 = 8.875%) and receives it with the food money. Send Koro never collects, files or pays it. Launching a state whose marketplace-facilitator law would make the platform collect is blocked (`services/api/src/core/tax.ts`).
- **Service charges:** set by the restaurant, shown before payment, part of S.
- **Restaurant promotions** (To build in the backend): the restaurant funds 100% of the discount, which lowers F. Send Koro charges nothing to run them.
- **Send Koro credit** (To build): funded by Send Koro, lowers the card charge but not F. See document 5.

## 1.9 What appears where

| Screen | Shows | Never shows |
|---|---|---|
| Customer receipt | Food, Delivery fee, restaurant's delivery discount, Tax, Courier tip, Send Koro credit (promo), Total / Card total | courier company, P, markup, card fee |
| Restaurant order money | Customer paid, its delivery share, card processing on food, promo credit paid back later, "Send Koro commission $0.00", You get | P, markup, courier company |
| Driver statement | Locked pay, tips (100%), NYC top-up | D, card share, payout cost, any fee line |
| Admin | everything, including provider names and the markup | — |
