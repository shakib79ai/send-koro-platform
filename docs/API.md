# Core API reference (`services/api`)

- **Base URL:** `https://api.sendkoro.com/v1`, or `http://localhost:3001/v1` locally. `/health` and `/webhooks/*` have no `/v1` prefix.
- **Auth:** `Authorization: Bearer <accessToken>`. Live streams (SSE) take `?access_token=` instead.
- **Money:** every amount is in integer cents.
- **Errors:** `{ "code": "...", "message": "..." }`. The message is written for people and can be shown as is.

## Sign in (one flow for sign up and sign in)

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/code` | `{ phone: "+19175550123", role }` | role: `customer` · `restaurant_staff` · `driver` · `admin`. Sends a 6-digit SMS code. |
| POST | `/auth/verify` | `{ phone, role, code, name?, email? }` | Returns `{ accessToken (15 min), refreshToken (30 days), isNew, user }` |
| POST | `/auth/refresh` | `{ refreshToken }` | Rotates: the old refresh token stops working |
| POST | `/auth/sign-out` | `{ refreshToken }` | |
| GET / PATCH | `/auth/me` | `{ name?, email? }` | |

## Customer

| Method | Path | Notes |
|---|---|---|
| GET | `/catalog/restaurants?lat&lng&q` | Public. Nearby live restaurants: open/busy, delivers, pickup, delivery rule |
| GET | `/catalog/locations/:locationId` | Public. Menu, hours, the restaurant's fees (shown before payment), tax note |
| GET / POST | `/me/addresses` | `label`: `home` · `office` · `other`. The first address becomes the default |
| PATCH / DELETE | `/me/addresses/:id` | |
| POST | `/me/devices` | `{ platform: ios\|android\|web, token }` for push |
| POST | `/orders/preview` | `{ locationId, fulfilment, addressId?, lines:[{itemId, quantity, optionIds?}], tipCents }` → receipt lines + ETA |
| POST | `/orders` | Same body plus `idempotencyKey` and `expectedTotalCents`. Returns `{ order, payment: { clientSecret, stripeAccount } }` |
| POST | `/orders/:id/payment-confirmed` | Call after Stripe.js / Apple Pay / Google Pay confirms. The order becomes `placed` |
| GET | `/orders`, `/orders/:id` | Order tracking. Own drivers show a first name and location; the courier company is never shown |
| POST | `/orders/:id/cancel` | Only before the restaurant accepts. Releases the card hold |
| SSE | `/live/orders/:id` | `order.updated`, `courier.assigned`, `courier.location` |

**Paying:** confirm the PaymentIntent on the restaurant's account. With Stripe.js, that's `loadStripe(pk, { stripeAccount })`, then `confirmPayment({ clientSecret })`. The card is only authorised at this point. It is charged when the restaurant accepts.

**Receipt lines** (`receipt.lines[].kind`): `food`, `fee` (restaurant-set), `tax` (restaurant-set, the restaurant remits it), `delivery` ("Delivery fee"), `delivery_discount` ("Free delivery from …" / "… pays part"), `tip`. There is never a card processing line.

## Restaurant portal (`restaurant_staff`)

| Method | Path | Who |
|---|---|---|
| POST | `/restaurants` | Creates the restaurant; the caller becomes owner |
| GET | `/restaurants/mine`, `/restaurants/:id` | Includes the go-live `checklist` |
| POST | `/restaurants/:id/locations` | Owner. NY and CA only for now; returns the suggested tax rate |
| PATCH | `/restaurants/locations/:locationId` | Manager. Includes `acceptingOrders` and `busyMinutes` |
| PUT | `/restaurants/locations/:locationId/hours` | Manager. `{ hours:[{dayOfWeek 0–6, opensAt "11:00", closesAt "22:00"}] }` |
| PUT | `/restaurants/locations/:locationId/tax-rate` | Owner. `{ taxRatePpm }` (88750 = 8.875%) |
| POST | `/restaurants/:id/tax-responsibility` | Owner. "I'm responsible for charging, reporting and paying sales tax" |
| POST / PATCH / DELETE | `/restaurants/:id/fees`, `/restaurants/fees/:feeId` | Owner. Service charge (always taxable), mandatory gratuity (must say "gratuity"), packaging, large-order fee |
| PUT | `/restaurants/:id/delivery-fee` | Owner. `{ rule, perOrderCapCents?, monthlyBudgetCents? }`. Each change is versioned in payments |
| GET / POST / DELETE | `/restaurants/:id/team[/:userId]` | Add staff by phone with role `owner` · `manager` · `staff` |
| POST | `/restaurants/:id/payouts/onboarding-link` | Owner. Opens Stripe-hosted onboarding |
| GET | `/restaurants/:id/stripe/overview` | Owner. Stripe tab: setup state, what Stripe still needs, payout schedule, bank (last 4), balance, recent payouts |
| POST | `/restaurants/:id/stripe/account-session` | Owner. `{ clientSecret, expiresAt, stripeAccountId }` for Connect embedded components (payments without refunds or capture, payouts, balances, documents, account management, notification banner), or `{ clientSecret: null, reason: 'no_account' }` |
| POST | `/restaurants/:id/go-live` | Owner. Needs location, hours, tax acceptance, delivery rule and payouts; starts the plan |
| GET / POST / PATCH / DELETE | `/restaurants/:id/menu…` | Categories and items with modifier groups. `PATCH /restaurants/menu/items/:id/availability` sets sold out (staff) |
| GET | `/restaurant-orders/:restaurantId/live?locationId=` | Live board. Each placed order has `acceptBy` (5-minute timer) |
| GET | `/restaurant-orders/:restaurantId/history?from&to` | |
| POST | `/restaurant-orders/orders/:id/accept` · `decline` · `preparing` · `ready` · `collected` | Accept captures the card; decline releases it |
| SSE | `/live/restaurants/:id` | `order.updated`, `courier.arrived` |

## Driver app (`driver`)

| Method | Path | Notes |
|---|---|---|
| POST | `/driver/apply` | `{ name, email, vehicle: bike\|ebike\|car\|walk }` |
| GET | `/driver/me` | `status` (applied/approved/suspended), `payoutsReady` |
| POST | `/driver/payouts/onboarding-link` | Stripe-hosted onboarding (connected account, like restaurants) |
| GET | `/driver/stripe/overview` | Stripe tab: setup state, what Stripe needs, payout schedule, bank, balance, payouts and weekly statements (pay, 100% tips, NYC top-ups; no fee lines) |
| POST | `/driver/stripe/account-session` | Client secret for Connect embedded components (payouts, balances, documents incl. 1099, account management); no payments list |
| PUT | `/driver/online` | `{ online, lat?, lng? }`. Needs admin approval and payouts first |
| PUT | `/driver/location` | Send every 10–15 s while online |
| GET | `/driver/offers` | Open offers: `distanceMeters`, `durationSeconds`, `payCents` (locked), `orderIds` (1 or 2), `expiresAt` (45 s) |
| POST | `/driver/offers/:id/accept` · `decline` | |
| GET | `/driver/trip` | Current pickups and dropoffs with locked pay and tip |
| POST | `/driver/deliveries/:orderId/arrived` · `picked-up` · `delivered` | `delivered` triggers the transfer: locked pay + 100% tip |
| GET | `/driver/earnings` | This week: pay, tips, trip time, NYC minimum and any top-up |
| GET | `/driver/history` | |
| SSE | `/live/driver` | `offer.new`, `order.ready` |

## Admin (`admin`)

| Method | Path |
|---|---|
| GET | `/admin/overview` |
| GET | `/admin/restaurants?q=` · POST `/admin/restaurants/:id/status` `{ status: live\|paused\|suspended }` |
| GET | `/admin/drivers?status=` · POST `/admin/drivers/:id/status` `{ status: approved\|suspended }` |
| GET | `/admin/orders?status&search` · `/admin/orders/:id` (includes the courier company, events and offers) |
| POST | `/admin/orders/:id/refunds` `{ requestId, reason, foodCents?, … }` — component refunds; retries are safe |
| POST | `/admin/orders/:id/retry-dispatch` |
| POST | `/admin/admins` `{ phone, name }` · `/admin/users/:id/disabled` `{ disabled }` |
| SSE | `/live/admin` |

## Webhooks (public, signature-checked)

| Path | From |
|---|---|
| `/webhooks/uber-direct` | Uber Direct: HMAC-SHA256 of the raw body, signing key in `UBER_DIRECT_WEBHOOK_SECRET` |
| `/webhooks/doordash` | DoorDash Drive: `Authorization` header equal to `DOORDASH_WEBHOOK_SECRET` |
| `/webhooks/stripe…` | Routed by Caddy to the payments service |
