---
description: Start Postgres if needed and run the payments test suite
---
1. Run `docker compose ps` from the repo root. If the `db` service isn't running, run `npm run db:up` and wait until it's healthy.
2. Run `npm test` from the repo root.
3. If anything fails, show the failing test name and the assertion, find the cause in `services/payments/src`, and propose a fix. Don't weaken a test to make it pass. The tests encode the rules in `docs/BUSINESS_MODEL.md`.
4. Finish with a one-line summary: files and tests passed or failed.
