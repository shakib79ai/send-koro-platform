# Design → code: what the apps still need

The prototypes in `designs/prototypes/` are newer than the app code. This list is what each real app is still missing compared with its design (checked 9 Nov 2026). Work through it after the Stripe sandbox is set up (`docs/payments/06-CLAUDE-CODE-RUNBOOK.md`, section A).

Labels: **Backend first** = needs a new API or payments endpoint before the screen can work (see the document named).

## Customer web + PWA (`apps/customer-web`) and customer app (`apps/customer-app`)

Both must get the same features. Match `customer-web.html` (desktop), `customer-pwa.html` (phone browser) and `customer-app.html` (Flutter).

| # | Feature | Design details | Backend |
|---|---|---|---|
| 1 | US address autocomplete | Suggestions while typing, full address in each row, keyboard navigation, "use as typed" only when nothing matches, chevron icon | Use a real geocoding/places provider through the API (`GET /v1/addresses/suggest`); the prototype's street list is demo only |
| 2 | "Allow your location" + GPS button | Modal on first home visit for guests; GPS button inside every address box; nearest address fills in | Browser/OS location permission; reverse geocode via the API |
| 3 | Cuisine row | Left/right arrows, mouse drag, touch scroll | — |
| 4 | Account hub | Profile, Wallet, Payment methods, Refer a friend, Addresses, Orders, Help | — |
| 5 | Profile | Edit name; add or change email **verified by code**; change phone **verified by code** | **Backend first:** `POST /v1/me/email/code`, `/verify`; `POST /v1/me/phone/code`, `/verify` (shared OTP service) |
| 6 | Payment methods | Several cards, default card, edit expiry/ZIP, remove with confirm, add card; choose card at checkout | **Backend first, needs Stripe confirmation:** saved cards across restaurants (payments doc 2 §2.9 item 9). Card logos come from Stripe, not drawn |
| 7 | Wallet | Promo balance, next-expiry pill, apply promo code, history | **Backend first:** payments doc 5 |
| 8 | Refer a friend | Link + code, copy and share, invited friends, rewards; phone-verified only | **Backend first:** payments doc 5 |
| 9 | Sign-up code | Optional "Promo or referral code" field at sign-up | **Backend first:** payments doc 5 |
| 10 | Credit at checkout | "Use Send Koro credit" toggle; receipt shows "Send Koro credit (promo)" and "Card total" | **Backend first:** quote `use_credit`, payments doc 5 §5.2 |
| 11 | Sticky "View cart" bar | Never covers menu items; count badge | — |
| 12 | Cart | Edit item ("Update item"), bin icon at quantity 1, "+ Add more items", "Complete your meal" quick add, utensils toggle | Utensils flag stored on the order (`POST /v1/orders` → `utensils: boolean`) |

## Restaurant portal + PWA (`apps/restaurant-web`)

| # | Feature | Design details | Backend |
|---|---|---|---|
| 1 | New-order sound | Built (`lib/orderAlert.ts`). No screen flash | — |
| 2 | Stripe tab | Built (`app/stripe/page.tsx`) | — |
| 3 | Promo credit on orders | Order money shows "Send Koro promo credit — paid back on your plan invoice" | **Backend first:** payments doc 5 |
| 4 | Subscription page | Plan per location, invoice with "Send Koro promo credit" negative line, "Promo credit this month" card | **Backend first:** payments doc 3 §3.4–3.5 |
| 5 | Menu editor v2 (Uber Eats / DoorDash / Grubhub style) | Tabs: Items · Categories · Option groups · Menus and hours · Promotions. **Items:** search, location picker, category filter, list rows with photo, labels, price ("From $4.75" for sizes), availability switch, bulk select (sold out, available, move, change price by % or $, delete), templates and import. **Item editor:** photo, name, description; **One price / Price by size** (e.g. 12/16/20 oz); main category + "Also show in"; shared option groups (add existing, create new, ready-made); labels (Popular, New, Chef's pick, Seasonal), dietary, spice level, the 9 major allergens, calories, serves; availability; sales tax showing every location's rate and a warning when a rate isn't set; per-location price and availability; special instructions on/off, extra prep minutes, POS code; customer preview. **Option groups:** library used by many items; Required/Optional, pick at least / up to, free choices, same choice more than once (max of each), choices with extra price, pre-selected, in stock, and "Then ask" nested group. **Templates:** coffee shop, juice and smoothie bar, bakery, pizza, burgers (categories, sized items, groups like Milk, Espresso shots, Flavor syrups, Boosts, Crust). **Import:** photos/PDF (Send Koro team builds it), CSV | **Backend first:** API tables `menu_categories`, `menu_items` (+ `item_sizes`, `item_categories` for "also show in"), `option_groups`, `option_choices` (with `next_group_id`), `item_option_groups` (ordered); bulk endpoints; menu import job. Order lines must store the chosen size and choices with prices at the time of ordering. Free choices: the cheapest N picks are free. Prices in integer cents |
| 5b | Templates by type of restaurant | 19 starter templates (Cafés and drinks: coffee shop, coffee and donuts, juice bar, bakery · Fast food: fast-food burgers with meal upgrade → side → drink, fried chicken buckets by piece count, pizza, burgers · Cuisines: Indian, Bangladeshi, Mexican, Chinese, Thai, Japanese and sushi, halal cart and Mediterranean, Italian and European, American diner, steakhouse, bowls) plus "Any restaurant" groups (remove ingredients, spice level, choose a side, choose 2 sides, add a drink, add a dessert). Ready-made group picker by type of restaurant; quick-add chips on every item. Same data model for every cuisine (no cuisine-specific screens), as on Uber Eats and DoorDash. Product UI never names other brands | Seed data only: store templates server-side as JSON (`menu_templates`), applied by `POST /v1/restaurants/:id/menu/templates/:key` (idempotent: skips items and groups that already exist). Also support DoorDash-style quantity limits per group: min/max distinct choices, max per choice, min/max total quantity |
| 6 | Toggle switches | Switch knob drawn as its own element (the old CSS-only knob broke on iPhone Safari) | — |

## Driver app (`apps/driver-app`)

| # | Feature | Design details | Backend |
|---|---|---|---|
| 1 | Welcome page | White top bar with colour logo and red DRIVER pill; kicker "Deliver in {area}" from the phone's location, hidden when unknown | Reverse geocode (borough/neighbourhood) via the API |
| 2 | Offer alert | Built (sound, vibration, torch, screen blink, settings) | — |
| 3 | Drop-off photo | In-app camera + choose from Photos; photo required where the order asks for it | `POST /v1/driver/trips/:id/proof` (upload) |
| 4 | Pay labels | "$X total" at the top; "Locked pay + tips = total" at the bottom | — |
| 5 | Stripe tab | Built (`lib/screens/stripe.dart`) | — |

## Admin console (`apps/admin-web`)

| # | Feature | Design details | Backend |
|---|---|---|---|
| 1 | Customer credit page | On/off, referrer and friend amounts, days valid, reward timing, monthly cap, minimum card charge; promo codes (add, pause); reconciliation table by restaurant | **Backend first:** payments doc 5 §5.6 |

## Order of work

1. Payments + API backend for credit, wallet, referral, promo (runbook C4–C7).
2. Profile email/phone verification and utensils (API).
3. Customer web/PWA screens, then the Flutter customer app.
4. Restaurant credit lines and subscription page; admin credit page.
5. Driver welcome, proof photo, pay labels.
6. Address autocomplete and location (needs a places provider — **ask** which one before choosing).

Every screen: compare side by side with the prototype at phone and desktop width before calling it done.
