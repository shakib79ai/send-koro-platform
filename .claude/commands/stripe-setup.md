---
description: Configure the Stripe SANDBOX for Send Koro (products, prices, webhooks, test accounts)
---
Set up the Stripe sandbox using the project's idempotent script. Never use live mode.

1. Check that `services/payments/.env` exists. Don't print it. Ask me to confirm it contains a **sandbox** key (starts with `sk_test_`) and a public `PUBLIC_BASE_URL`; for local work this is a tunnel such as `stripe listen` or ngrok. If it isn't a sandbox key, stop.
2. Run `npm run stripe:setup` from the repo root.
3. From the output, report:
   - the 6 restaurant plan prices
   - the 3 webhook endpoints
   - the Accounts v2 event destination
   - the portal
   - the test restaurant and test driver onboarding links

   Remind me to paste the printed `whsec_…` secrets into `.env` myself.
4. Then list the Dashboard-only steps still open from `docs/STRIPE_DASHBOARD_CHECKLIST.md`.
5. If the Stripe MCP server is connected, use it to confirm the sandbox now has the products `sk_restaurant_subscription` and the expected webhook endpoints.
