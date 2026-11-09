# Restaurant portal: web + PWA

Next.js 15. The same app runs in the browser and installs as an app on tablets, phones and desktops (Chrome or Edge "Install app", Safari "Add to Dock" / "Add to Home Screen"). Matches the Restaurant Web and Restaurant PWA designs in `docs/DESIGNS.md`.

```bash
cp .env.example .env.local
npm install
npm run dev          # http://localhost:3200 (needs services/api on :3001)
```

| Page | What it does |
|---|---|
| `/setup` | List your restaurant: details → location & delivery area → hours → sales tax (rate + responsibility) → who pays delivery → Stripe payouts → go live |
| `/` | **Live orders.** New orders ring until accepted, with a 5-minute countdown (then auto-decline). Accept with prep time, reject with a reason, mark preparing / ready / picked up. Pause or mark a location busy. Today's KPIs |
| `/orders` | History with a date range and CSV export |
| `/menu` | Categories and items with option groups. Sold-out toggle (staff), or sold out for 4 hours |
| `/earnings` | Food sales, tax collected, delivery help paid, $0 commission, daily chart. Payouts and fees open in Stripe |
| `/plan` | Current plan band, next month's projection, all bands, savings calculator |
| `/settings/*` | Delivery fee rule (versioned consent), taxes & fees, locations & delivery radius, hours, alerts, team & roles |

**Roles:**
- **Owner:** everything.
- **Manager:** menu, hours, locations, staff.
- **Staff:** live orders and sold-out toggles.

The API enforces these roles; the UI only hides what a role can't do.

**Not built yet** (the designs show them; ask before building):
- Offers (day- or item-based free delivery)
- Printers
- Holiday closures (pause the location instead)
- Collecting permit documents (Stripe collects EIN and identity)
