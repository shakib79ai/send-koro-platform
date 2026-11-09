---
description: Review current changes against Send Koro's money and product rules
---
Review the uncommitted changes (`git diff` and new files) against `docs/BUSINESS_MODEL.md`, the "Rules that must never be broken" section of the root `CLAUDE.md`, and `docs/STRIPE_TECHNICAL_BRIEF.md`.

Check specifically:
- integer cents only
- direct charges with `stripeAccount`
- `application_fee_amount = D + T − delivery fee share`
- no courier company names in customer-facing text
- no card processing fee charged to customers
- nothing deducted from driver pay or tips; no driver subscription
- Send Koro never collects or remits sales tax
- idempotency keys and unique constraints on every money write
- no live keys or `.env` contents in code, logs or tests
- tests added for new money paths

Report each finding as file:line, then the rule, then why it breaks it, then the fix. Say plainly if everything passes.
