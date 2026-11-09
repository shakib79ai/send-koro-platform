---
description: Dry-run explain or run the restaurant subscription tier job for a month — usage /tier-job 2026-10
argument-hint: <YYYY-MM>
---
Month: $ARGUMENTS (if empty, the previous New York calendar month).

1. Explain what will happen. For each restaurant subscription: net food sales = food − food refunds for that month in America/New_York; the tier from `services/payments/src/core/tiers.ts`; and whether the Stripe price changes. Changes use `proration_behavior: 'none'` and are locked with a snapshot.
2. Ask me to confirm and to confirm the key is a sandbox key, then run `npm run tiers:run -- $ARGUMENTS`.
3. Show the result table and any restaurants whose price changed.
