---
description: Change the database schema safely (Drizzle) — usage /new-migration <short_name> <what to change>
argument-hint: <short_name> <description of the change>
---
Schema change requested: $ARGUMENTS

1. Edit `services/payments/src/db/schema.ts`. Amounts are `bigint` cents, mode `number`. Add unique constraints wherever duplicate events could create duplicate rows.
2. From `services/payments`, run `npx drizzle-kit generate --name <short_name>`. Never hand-edit files in `drizzle/`.
3. Show me the generated SQL and point out anything destructive, such as dropped columns or NOT NULL without a default.
4. Run `npm run db:migrate` and `npm test` from the repo root.
