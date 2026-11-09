# Customer web + PWA

Next.js 15 (App Router). Installable as a PWA on iPhone and Android ("Add to Home Screen"), with an offline page and cached app shell. Matches the Customer Web / PWA designs in `docs/DESIGNS.md`.

```bash
cp .env.example .env.local    # API URL + Stripe SANDBOX publishable key
npm install
npm run dev                   # http://localhost:3100 (needs services/api on :3001 and services/payments on :3000)
```

| Page | What it does |
|---|---|
| `/` | Hero, cravings, free-delivery deals near you, all restaurants (delivery/pickup) |
| `/search` | Search by name or cuisine; free-delivery filter |
| `/restaurants/[locationId]` | Menu by category, item options, the restaurant's fees shown before payment, cart |
| `/checkout` | Address (Home/Office/Other), tip (100% to courier), Stripe Payment Element (cards, Apple Pay, Google Pay, Link), receipt from the API |
| `/orders`, `/orders/[id]` | History with reorder; live tracking over SSE |
| `/sign-in` | One page for sign in and sign up: phone code → name → first address |
| `/account` | Profile and addresses |

## Rules this app follows

- **Totals come only from the API** (`POST /v1/orders/preview`). The app never adds its own fees, and the receipt lines are shown exactly as returned.
- **Stripe.js is initialised with the restaurant's account** (`stripeAccount` from the preview) because orders are direct charges. Card details go straight to Stripe.
- **The card is authorised on "Place order" and charged when the restaurant accepts.** The copy says so.
- **No courier company names, and no card fees.**

Apple Pay on the web needs the domain registered in Stripe; the payments service does this per restaurant account via `PAYMENT_METHOD_DOMAIN`.
