# Send Koro — business model and decisions

This is the source of truth for product and money rules. Where it differs from `STRIPE_TECHNICAL_BRIEF.md` (v1.2), **this document wins**. Each rule notes when it was decided.

## Platform

- Food-ordering marketplace launching in **New York City**, with US expansion to follow.
- **Apps:**
  - Customer: Web, PWA, iOS, Android, with identical features on all four.
  - Restaurant: Web and PWA (phone, tablet and installed desktop app), with identical features.
  - Driver: separate iOS and Android Flutter apps.
  - Admin console.
- **Design system "Saffron & Ink":**
  - Fonts: Sora (headings) and Inter (text).
  - Colours: orange `#FF7A00`, ink `#0E0F12`, paper `#F7F7F5`.
  - Screen designs: `DESIGNS.md`.

## Restaurants

- **$0 commission on food.** Restaurants keep their food sales minus card processing and any delivery subsidy they choose.
- **Monthly plan from the previous calendar month's net food sales** (food after discounts, minus food refunds; New York time). Tips, tax, delivery and service charges are excluded.

  | Food sales last month | Plan |
  |---|---|
  | up to $2,500 | $50 |
  | $2,500.01 – $5,000 | $100 |
  | $5,000.01 – $7,500 | $150 |
  | $7,500.01 – $10,000 | $250 |
  | $10,000.01 – $15,000 | $350 |
  | over $15,000 | $500 |

  - The first month is free.
  - Zero or negative months pay the lowest plan.
  - **Each location has its own plan**, from that location's own net food sales (5 Nov 2026; replaces "one plan covers all locations"). All locations are billed together on one invoice, one line each.
  - A new location's first month is free; locations that aren't live yet aren't billed (5 Nov 2026, proposed in the prototype; confirm).
  - **Each location may use its own connected Stripe account** or the account's main one (5 Nov 2026). Direct charges for a location's orders go to that location's account.
  - Billed on the 1st at 12:00 ET, with no proration.
  - Late refunds count in the month they're processed.
- **Card processing** (2.9% + 30¢ under Stripe standard pricing) is paid by the restaurant on the food part of each order. **Customers are never charged a card processing fee** (3 Nov 2026).
- **Sales tax is the restaurant's responsibility** (3 Nov 2026):
  - The restaurant sets its rate. A rate is suggested from its address.
  - The restaurant must accept "I'm responsible for charging, reporting and paying sales tax" before taking orders.
  - The tax goes to the restaurant with the food payment.
  - **Send Koro never collects, files or pays sales tax.**
  - Launch is **blocked** in any state whose marketplace-facilitator law would force the platform to collect on restaurant meals (e.g. Georgia above $100k). NY and CA are fine.
- **Service charges and extra fees** are set by the restaurant. Types: service charge, mandatory gratuity, packaging fee, large-order fee.
  - Each must be shown on the menu and in the cart before payment.
  - In NY a service charge is taxable.
  - A mandatory gratuity is untaxed only if it is listed separately, labelled "gratuity", and paid 100% to staff.
- **Menu editor** (8 Nov 2026, modelled on Uber Eats Menu Maker and the DoorDash Merchant Portal; designed in the prototypes, backend to follow):
  - **Menus with hours:** e.g. "All day" and "Lunch specials" (days + from/to). Sections belong to one or more menus; a dish shows only while one of its menus and the location are open. Sections have a name, optional description and an order.
  - **Item:** photo (16:9, at least 1400 × 800), name, description, price, optional pickup price, section, "Popular" flag, dietary/allergen labels (vegetarian, vegan, gluten-free, halal, spicy, contains nuts, contains dairy), calories (number or range; NYC requires them for chains with 15+ locations), sales tax (taxable at the location's rate or not taxable; the restaurant decides and files), availability (available / sold out today / sold out until turned back on), optional item-only days and times, per-location price and sold-out (unchanged).
  - **Option groups:** name, pick at least (0 = optional), pick up to, number of free choices (the cheapest picks are free), most of each choice; each choice has an extra price, "selected by default" and in/out of stock. Groups can be copied from another dish.
- **Promotions** (8 Nov 2026; designed in the prototypes, backend to follow). Types, as on Uber Eats and DoorDash: buy 1 get 1 free, discount on items (% or $), free item with a minimum order, spend $X save $Y, percent off the order (optional cap), free delivery over a minimum.
  - Settings: customers (all, new, returning, haven't ordered in 30 days), locations, once per customer, start date, end date or ongoing, whenever open or certain days/times (happy hour, lunch special), optional weekly budget (pauses until Monday when reached), pause/resume/end, results (orders, food sales, discount paid).
  - **The restaurant funds 100% of the discount. Send Koro charges nothing to run a promotion** (no marketing fee, no commission). Food discounts lower the food price (F), so they lower card processing on food and the net food sales the monthly plan is based on. Sales tax is charged on the price after the restaurant's discount.
  - One promotion per order: if several apply, the customer gets the one that saves the most. The cart shows "{Restaurant} offer −$X".
  - Free delivery is the restaurant paying the delivery fee as its delivery share, so the proposed NYC 15% cap applies; when it binds the customer sees "$X off delivery" instead of "Free delivery".
  - Example, BOGO on a $15.00 bowl: 2 bowls + $4.50 lemonade = $34.50 → offer −$15.00 → food $19.50, tax 8.875% = $1.73. Cost to the restaurant $15.00. Free delivery over $25 on $32.50 food: fee $8.48, restaurant pays $4.87 (15%), customer pays $3.61.
- **Order acceptance:** the card is authorised at checkout and charged only when the restaurant accepts. Unanswered orders are declined and released after 5 minutes.

## Delivery fee (who pays)

The restaurant chooses, per location or for all locations, and every choice is stored as a versioned consent:

1. Customer pays the full delivery fee.
2. Restaurant pays all (free delivery).
3. Split: the restaurant covers a fixed $ amount or a % of the fee; the customer pays the rest.
4. Free above an order amount, with optional fixed help below it.

Plus an optional **per-order cap** (the customer pays any excess) and a **monthly budget** (customers pay once it's used up). Free-delivery offers (day- or item-based) stack on top; the customer gets the better deal, and the restaurant never pays more than the fee.

The customer always sees a single line, **"Delivery fee"**, then any "Free delivery from {Restaurant}" or "{Restaurant} pays part" discount. **The courier company is never named to customers** (3 Nov 2026).

## Fulfilment

- **Customers see each location separately** (5 Nov 2026), nearest first, with address search (no distance shown or filtered; 6 Nov 2026). A location delivers only inside the delivery radius Send Koro sets for it; outside it the customer can order pickup.
- **Delivery areas are set by Send Koro, not by restaurants** (7 Nov 2026; replaces the 5 Nov restaurant-set rings/ZIPs). This follows Uber Eats and DoorDash, where the platform sets the delivery radius. Designed in the prototypes; backend to follow.
  - **Admin, Delivery zones and rules:**
    - Service areas (Brooklyn, Queens, Manhattan…): open/closed, a delivery radius per area (straight-line miles from the restaurant; e.g. Brooklyn 5, Queens 4, Manhattan 3), and a bad-weather pause that turns delivery off for the whole area (pickup stays open).
    - One longest-delivery limit for every area (5 mi).
    - Up to 3 distance bands for every area. Each band has extra minutes on the delivery estimate and an optional minimum order. Example: 0–1.5 mi +0 min/$0; 1.5–3 mi +5 min/$0; 3–5 mi +10 min/$12.
    - Availability rules: hide delivery when courier time + prep is over 60 min; stop delivery orders 15 min before closing; shrink the radius to 2 mi when courier wait is over 12 min; show pickup only when no courier is available.
    - **Per-location custom radius**, set only by admin, smaller than the area radius only (e.g. food that doesn't travel well).
  - **Restaurant portal and PWA:** no delivery area, rings, ZIP codes, minimums or delivery-hours settings. Restaurants keep Open/Close, opening hours, prep time and "Accepting orders" per location.
  - **Customer:** unchanged. No distances are shown anywhere (6 Nov 2026). When a location can't deliver to the address (outside the radius, paused, or no courier), only Pickup can be chosen. Listings say "Delivers to you", "Pickup only for your address", "Delivery paused right now" or "Closed · opens …", with the band's minimum order where one applies. Checkout blocks delivery below the minimum and offers pickup.
  - **Delivery fee = courier quote (P) + hidden card-processing share + hidden payout cost** (the D formula below). Send Koro adds nothing else: **no service fee, no small-order fee, no busy-time or surge fee, no distance fee.** The courier's own quote already grows with distance and may rise at busy times.
  - **NYC fee caps (enforced by DCWP; NYC fee-cap flyer, April 2026):** what a delivery app charges a restaurant is capped at 15% of the order for delivery, 5% for basic service, 3% for card processing and 20% for optional enhanced service. Send Koro charges $0 commission and no per-order fees, so the only per-order amount is the restaurant's chosen delivery share. **Proposed rule:** cap a restaurant's share of the delivery fee at 15% of its food on that order; the customer pays the rest. Example: $30 food, restaurant chose "pays all" on an $8.48 fee → restaurant pays $4.50 (15%), customer pays $3.98. Needs a lawyer's confirmation that the voluntary delivery share counts toward the delivery cap; not yet enforced in the API.
  - **NYC delivery-worker rules for own drivers:** offers show distance, route and locked pay before acceptance; each driver's maximum distance and "no bridges or tunnels" settings are respected; declining has no penalty; restaurants confirm restroom access.
- **Drop-off choice** (6 Nov 2026, designed in the prototypes; backend to follow). The customer picks at checkout and can change it until the courier picks up:
  - **Leave at my door:** the courier must take a photo of the order at the door, and the customer sees it on the tracking page.
  - **Hand it to me:** each order gets a 4-digit PIN, shown to the customer on the order-placed and tracking screens. The courier must enter it to complete the delivery. If the customer can't find it, support texts it to them.
  - The driver sees the method on the offer and at drop-off.

- **Providers:**
  - Uber Direct: primary.
  - DoorDash Drive: backup, pending approval.
  - Send Koro's own drivers.
- **Courier price (P)** = the Uber Direct quote (about $7.80 average), including for own drivers.
- **Delivery markup (5 Nov 2026):** the delivery price **D = P + payout cost + card-fee cost**, the smallest amount at which Send Koro breaks even on the delivery money after Stripe's card fee and the cost of paying the courier. The customer sees one "Delivery fee" line, the same for every payment method; there is never a separate card fee. **The markup and the courier's own price are never shown to customers or restaurants** (receipts, restaurant portal, invoices); they appear only in the admin console, where the markup is configured. Restaurant delivery rules (split, free over, pays all) apply to D.
  - Payout cost per delivery: 0.25% of (P + tip) + 25¢ for both own drivers and third-party couriers (5 Nov 2026). For Uber Direct and DoorDash the money is paid out to Send Koro's bank and then settled to the provider. Both are settings and need Stripe's or the provider's written fee schedule.
  - Example, $30 food, $2.66 tax, $5.40 tip, restaurant pays $3: own driver or third party, P $7.80 → **D $8.48** (payout 29¢ + card 39¢). In both, the application fee after the card share equals P + tip (+ payout cost), so drivers and couriers still get their full pay and 100% of the tip.
- **Third-party couriers** are paid by their invoice, not through Stripe Connect. The full tip is sent through their tip field (DoorDash requires 100% pass-through).

## Own drivers

- **Connected Stripe accounts set up like restaurants** (3 Nov 2026): full Dashboard; Stripe collects fees and covers losses; recipient configuration for weekly transfers. Needs Stripe's written confirmation.
- **No driver subscription and no fees charged to drivers** (decided 29 Oct, confirmed 3 Nov 2026).
- **Driver pay (7 Nov 2026; replaces the rate card):** each order pays the driver **the delivery fee minus the card-fee share and the payout cost**, which is exactly the courier price P the fee was built from (D = P + payout + card share). Customers and restaurants see D. The driver sees only their pay, never D, the card fee or the payout cost, and no fee lines appear on driver statements.
  - Example: delivery fee **$8.48** − card share 39¢ − payout 29¢ = **$7.80** locked pay, plus 100% of the $5.40 tip.
  - **Two orders on one route** (batching) like Uber and DoorDash: the driver gets each order's own amount, e.g. $7.80 + $6.50 = $14.30.
  - The old rate card ($2.50 + 45¢/min + 75¢/mi) is kept only as a fallback for an order with no stored courier price.
  - Send Koro breaks even on own-driver delivery money, the same as on third-party deliveries.
- **Upfront, locked pay:** before accepting, the driver sees distance, total time and pay. Pay **never goes down** for traffic or delays.
- **NYC minimum pay:** $22.13 per hour of trip time (standard method; $36.88 under the alternative method). If actual trip time pushes pay below that, the shortfall is added to the weekly payout automatically. Locked pay cannot remove this legal check. Built: every Monday 06:00 ET the API totals last week's trips and the payments service transfers any shortfall once per driver per week.
- **Tips:** 100% to the driver, never used to meet the minimum, never reduced.
- **Payouts:** weekly on Mondays to the driver's own Stripe account. Instant payouts are off at launch.
- **Driver onboarding, minimum requirements only** (7 Nov 2026, designed in the driver app prototype; backend to follow):
  - **Applying:**
    - Legal name, email, date of birth (18+).
    - Vehicle: bike, e-bike (UL-certified, required in NYC), moped or car. Mopeds and cars also need a driver's license with its expiry, insurance that covers delivery, and a plate.
    - Photo ID, plus license and insurance photos for mopeds and cars.
    - Independent contractor agreement.
    - Background check disclosure and authorization (FCRA), covering identity, SSN trace and, for mopeds and cars, the driving record.
    - Stripe account. Stripe verifies identity and bank and collects tax details like a W-9.
  - **NYC Fair Chance Act order:** first checks, then a conditional offer, then a separate authorization for the criminal history check (with the FCRA summary and NY Correction Law Article 23-A). If something comes up, the driver gets a Fair Chance notice with the report, the written Article 23-A assessment and at least 5 business days to respond, and a person reviews the response.
  - **Before the first delivery:** the driver confirms the NYC Notice of Rights (also emailed and texted) and, for e-bikes and mopeds, the lithium-ion battery safety sheet (Local Law 41 of 2023), and sets their delivery limits. A free insulated bag is sent after the 6th delivery.
  - **NYC delivery worker rights in the app:**
    - Limits: the driver sets the farthest restaurant-to-customer distance (1, 2, 3 or 5 mi) and whether to cross bridges and tunnels. Offers outside these limits aren't sent.
    - Before accepting, the offer shows pickup, distance, time, pay, tip and any bridge or tunnel.
    - Daily statements show each tip and the day's pay and tips.
    - Restroom access is shown at pickup.
    - The Notice of Rights page sits under Account.
  - **Taxes:** Send Koro is the payer and issues a **1099-NEC** to each driver paid $2,000 or more in the year (2026 threshold). It covers locked pay, tips and NYC top-ups and is filed through Stripe's 1099 product. Stripe doesn't issue 1099-Ks to drivers, because they take no card payments.
  - **To confirm with counsel and a broker:** contractor classification in NY (Matter of Vega, 2020), and insurance (occupational accident cover, contingent auto liability, general liability).

## Processing fees on delivery money (3 Nov 2026)

- The delivery money pays its own share of Stripe's processing fee: **share = fee × (customer delivery contribution + tip) ÷ order total**.
- It is settled by lowering the application fee, so restaurants don't pay processing on delivery.
- **The fee share is never taken from a driver's pay or tip.** It comes out of Send Koro's delivery margin, for own drivers and third-party couriers alike.
- **Known cost:** about 33¢ on a $39 order with a $5 customer delivery fee and a $4 tip. Now covered by the delivery markup, and own-driver pay equals the courier price, so own-driver deliveries break even.
- **Recommended, not built yet:** add the fee share to the delivery price at quote time.

## Stripe configuration

| Setting | Choice |
|---|---|
| Charge type | Direct charges on the restaurant's account |
| Connect pricing | **Stripe handles pricing for your users** (no per-account fees for Send Koro on restaurant accounts) |
| Losses | Stripe (`losses_collector = stripe`) |
| Fees | Stripe collects from the connected account (`fees_collector = stripe`) |
| Restaurant Dashboard | Full Stripe Dashboard |
| Onboarding | Stripe-hosted, Accounts v2 |
| Billing | Pay-as-you-go (0.7% of subscription volume) until restaurant subscriptions exceed about $88k/month |
| Stripe Tax | Off for orders (restaurants handle tax) |
| Payment methods | Cards, Apple Pay, Google Pay, Link; domain `sendkoro.com` |

### Referral program and promotional credit (9 Nov 2026)

- **Offer:** "Refer a friend: give $5, get $5." The person who refers and the new customer each get **$5** of Send Koro credit.
- **Who can earn or use credit:** phone-verified accounts only. One referral reward per person, phone number, device and card; internet (VoIP) and temporary numbers can't earn rewards. Up to 10 referral rewards per person per month (admin setting).
- **When it's given (decided 9 Nov 2026):** the new customer's $5 when they create an account with a referral code and verify their phone; the referrer's $5 **after the friend's first completed order** (delivered or picked up, not refunded in full), which protects against fake accounts. Admin can switch the referrer's reward to "when the friend verifies their phone", but the default is the first order.
- **Credit rules:** added to the customer's wallet as a promotional gift; valid **30 days**; redeemable only at checkout on an order; oldest credit is used first; no cash value; can't be transferred or withdrawn.
- **How much credit one order can take:** credit covers only the restaurant's part of the order (food + tax) and always leaves at least **$0.50** of it on the card. The delivery fee and tip are always paid by card, so the application fee (D + T − delivery share) always fits inside the charge.
  - Example: $30 food + $2.66 tax + $4.92 delivery after the restaurant's $3 share + $5.40 tip = $42.98; $10 credit → card total $32.98, application fee unchanged.
- **Promo codes** (for example WELCOME10) follow the same rules and are managed in admin (amount, end date, usage limit, once per customer).
- **Customer apps:** a "Refer a friend" page with the person's code (NAME5) and link (`sendkoro.com/r/CODE`), share buttons and invite status; an optional "Add a promo or referral code" box at sign-up (web, PWA and apps); a "Use Send Koro credit" switch at checkout.
- **Who pays:** Send Koro funds all credit. The restaurant still receives its full food price and couriers keep their full pay and 100% of tips.
- **How the money moves:**
  - The customer's card is charged the order total minus the credit, as a direct charge on the restaurant's account, so the restaurant receives the credit amount less at the time of the order.
  - Send Koro pays it back as a "Send Koro promo credit" line on the restaurant's next monthly plan invoice.
  - If the credit is more than that month's plan fee, the remainder is sent to the restaurant's Stripe account in the same monthly run (decided 9 Nov 2026), so restaurants are never left waiting.
- **Receipts and statements:**
  - The customer receipt shows "Send Koro credit (promo)" and the card total.
  - The restaurant's order screen shows the credit, the amount paid now and the amount reimbursed on the invoice.
  - Admin's "Customer credit" page shows the program settings, promo codes and the month's pay-back per location.
- **Open questions:**
  - Stripe's confirmation in writing that a direct charge lowered by platform-funded credit, with the platform paying the difference back later, is acceptable.
  - Accounting treatment of credit as a marketing expense.
  - Whether credit affects the tier base. Proposed: no, because the restaurant's net food sales are unchanged.

### Stripe tab in the apps (9 Nov 2026)

- **Restaurant portal → Stripe** (owner only): setup state and what Stripe still needs, balance, payout schedule, bank (last 4), recent payouts, plus Stripe's Connect embedded components: Payments, Payouts, Statements & tax forms (1099-K), Account & bank (onboarding until active, then account management), and Stripe's notification banner.
  - The embedded payments list has **refunds and capture turned off**: refunds go through Send Koro's order screen so the application fee is refunded correctly, and capture happens when the restaurant accepts. Restaurants may answer disputes on their own direct charges.
- **Driver app → Stripe tab:** setup state, balance, payout schedule, bank, weekly statements (locked pay + 100% of tips + NYC top-ups, never any fee lines), recent payouts, and "Open Stripe Dashboard" for bank changes and the 1099-NEC.
- **Instant payouts stay off** in both apps at launch.
- Both account types have the full Stripe Dashboard, so Stripe asks the user to sign in to Stripe for sensitive changes (bank, payout schedule). This can't be switched off for these accounts.
- **Note:** driver money reaches the driver's Stripe balance after each delivery (one transfer per order), and NYC top-ups on Monday; Stripe then pays the bank on the account's own payout schedule. "Weekly on Mondays" below describes top-ups, not a forced payout schedule, because platforms can't set the schedule on full-Dashboard accounts.

Platform account from the brief: `acct_1UVa9IQzpvBKCndf`. Support contact info@shlglobal.biz, +1 917-624-8233. Website https://sendkoro.com.

## Open decisions

- Whether to add the delivery fee share to the delivery price (recommended).
- Refund policy when a cancelled order's driver or supplier has already been paid.
- Stripe's written answers to the brief's review questions; see `services/payments/README.md`.
