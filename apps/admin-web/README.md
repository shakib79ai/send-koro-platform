# Admin console

Next.js 15. Matches the Admin console design in `docs/DESIGNS.md`. Admins only: the API checks the `admin` role on every `/v1/admin/*` call.

```bash
cp .env.example .env.local
npm install
npm run dev              # http://localhost:3300
# first admin: npm run seed:admin -- +1917XXXXXXX "Your Name"   (repo root)
```

| Page | What it shows |
|---|---|
| Operations | 24-hour KPIs, active orders, deliveries by provider, live event feed, delivery problems |
| Orders | Search, full detail with courier company, D/C/R split, timeline, **component refunds** (idempotent), send to courier company now |
| Dispatch & integrations | Uber Direct / DoorDash Drive mode (mock, sandbox, live), own-driver fleet, dispatch order, payments service health |
| Restaurants | Status (live, paused, suspended), tax acceptance, delivery rule version, Stripe readiness |
| Drivers | Approve or suspend; online status; Stripe readiness |
| Restaurant payouts | Platform volume on restaurant accounts; per restaurant: Stripe balance and payouts, ledger, transactions (app fee, fee share, courier), refunds |
| Driver & courier settlements | Own-driver transfers (locked pay + 100% tip), owed/failed with retry, NYC minimum-pay top-ups; Uber Direct and DoorDash obligations with invoice reconciliation |
| Billing & platform | Delivery allocation received vs paid to drivers and couriers; restaurant plans and tiers |
| Taxes & compliance | Launch and blocked states; every restaurant's tax acceptance and rates; warnings |
| Admins | Add admins, disable or enable accounts |

Courier company names appear here only. The customer and restaurant apps never show them.
