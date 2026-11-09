# Kick-off prompts for Claude Code

Open this repo in VS Code with Claude Code (or in Claude Code on the web). Paste the prompts one at a time; wait for each to finish.

## Prompt 1 — check the project and set up the Stripe sandbox

```
Read CLAUDE.md, docs/BUSINESS_MODEL.md, docs/payments/README.md and docs/payments/06-CLAUDE-CODE-RUNBOOK.md.
Then do runbook section A (sandbox setup) step by step:
install, start Postgres, migrate, run npm run stripe:setup with --with-test-accounts,
set up webhook forwarding, run npm test and npm run typecheck.
Use only sandbox keys from my environment. Never print keys or read .env files.
Stop and tell me exactly what to click when a step needs me in the Stripe Dashboard
(docs/STRIPE_DASHBOARD_CHECKLIST.md). At the end, report what passed and what failed.
```

## Prompt 2 — check the money paths end to end

```
Do runbook section B in the sandbox: onboard the test restaurant and driver, place the
$30.00 split-rule order, accept, decline another, mark own-driver delivered, refund food,
dry-run /tier-job for last month. Compare every amount with docs/payments/01-MONEY-MODEL.md
§1.5 (card charge 4354, application fee 1349, driver 1320). Report any difference.
```

## Prompt 3 — build the missing backend

```
Do runbook section C tasks C1 to C7 in order (stale README, per-location plan lines,
fee share credit, wallet and credit ledger, priceDelivery with credit, referral and promo
codes, month-end credit pay-back). Follow docs/payments/03 and 05 exactly.
For each task: write the tests listed in the docs first, then the code, run /check-business-rules
and npm test, explain the money change with a worked example in cents, and commit.
Ask me before anything marked "Needs confirmation".
```

## Prompt 4 — make the apps match the new designs

```
Read docs/DESIGNS.md and docs/DESIGN_TO_CODE.md. Open each prototype in designs/prototypes/
and build the missing features in the matching app, in the order at the end of DESIGN_TO_CODE.md.
Customer web/PWA and the Flutter customer app must have the same features. Totals always come
from the API. Ask me before choosing an address/places provider. Commit one feature at a time
and run the app's checks (typecheck, flutter analyze/test) before each commit.
```

## Prompt 5 — get ready to deploy

```
Read docs/DEPLOYMENT.md and runbook section D. List what I need to do (server, GitHub secrets,
Stripe live activation) and what you can do. Don't touch live mode until I say so.
```
