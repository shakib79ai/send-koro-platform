# Send Koro

NYC food-delivery marketplace: $0 commission for restaurants, a flat monthly plan, and Stripe Connect direct charges.

This repository is set up for **VS Code + Claude Code**. Claude Code reads `CLAUDE.md` automatically, so it knows the business rules, commands and design links from the first prompt.

## What's here

| Path | What it is |
|---|---|
| `apps/customer-web/` | **Customer web + PWA** (Next.js): browse, menus with options, checkout with Stripe (cards, Apple Pay, Google Pay), live tracking, Home/Office/Other addresses. Installable on phones. |
| `apps/restaurant-web/` | **Restaurant portal + PWA** (Next.js): setup wizard, live orders board with sound and 5-minute countdown, menu editor, earnings, plan, delivery fee, taxes & fees, locations, hours, team. Installs on tablets, phones and desktops. |
| `apps/admin-web/` | **Admin console** (Next.js): operations, orders with component refunds, dispatch & integrations, restaurants, drivers, restaurant payouts (Stripe balances and payouts), driver & courier settlements, billing, taxes & compliance. |
| `apps/customer-app/` | **Customer app** (Flutter, iOS + Android): browse, menus with options, checkout with Stripe's payment sheet (cards, Apple Pay, Google Pay), tracking, orders, Home/Office/Other addresses. CI builds a debug APK. |
| `apps/driver-app/` | **Driver app** (Flutter, iOS + Android): sign in, apply, Stripe payouts, online with location, locked offers with countdown (2 orders on one route), trip steps, earnings with the NYC minimum check. CI builds a debug APK. |
| `services/api/` | **Core API** the apps call: phone sign-in, restaurants, menus, ordering, dispatch (Uber Direct, DoorDash Drive, own drivers with locked offers and batching), driver app, admin. 32 tests. Reference: `docs/API.md`. |
| `services/payments/` | Payments service: NestJS 11, Drizzle, Postgres, Stripe Connect (direct charges, delivery allocation, driver payouts, NYC minimum-pay top-ups, restaurant plans). 61 tests. |
| `deploy/` | Production Docker Compose for one server: Postgres, both services, Caddy (automatic HTTPS), nightly backups. |
| `.github/workflows/` | CI (typecheck, tests and build for both services) and Deploy (images to GitHub Container Registry, then the server over SSH). |
| `docs/DEPLOYMENT.md` | Step-by-step: server, GitHub secrets, first deploy, Stripe webhooks, couriers, going live. |
| `docs/BUSINESS_MODEL.md` | Every business decision so far: pricing, fees, tax policy, delivery rules, driver pay. |
| `docs/STRIPE_TECHNICAL_BRIEF.md` | The Stripe developer brief (v1.2). |
| `docs/STRIPE_DASHBOARD_CHECKLIST.md` | Stripe settings only a person can make in the Dashboard. |
| `designs/` | The 7 approved clickable prototypes (`designs/prototypes/*.html`, open in a browser) and their source. |
| `docs/DESIGNS.md` | Which prototype belongs to which app, plus claude.ai links. |
| `docs/DESIGN_TO_CODE.md` | What each app still needs to match the designs. |
| `docs/payments/` | Payments developer documents and the Claude Code runbook. |
| `docs/CLAUDE_CODE_KICKOFF.md` | **Start here:** prompts to paste into Claude Code, in order. |
| `CLAUDE.md` | Instructions Claude Code follows: rules, commands, conventions. |
| `.claude/commands/` | Slash commands: `/test`, `/stripe-setup`, `/new-migration`, `/check-business-rules`, `/tier-job`. |
| `.claude/settings.json` | Pre-approved safe commands. Blocks reading `.env` files and anything with live Stripe keys. |
| `.mcp.json` | Stripe's official MCP server, so Claude Code can look things up in your Stripe sandbox. |
| `.vscode/` | Recommended extensions, debug configurations and tasks. |
| `docker-compose.yml` | Local Postgres (dev and test databases) on port 5433. |

## First-time setup (about 10 minutes)

You need **Node 22**, **Docker Desktop**, **VS Code**, the **Stripe CLI** (`npm install -g @stripe/cli`) and **Claude Code**.

1. **Unzip the project and open the folder in VS Code.** Install the recommended extensions when prompted: Claude Code, Stripe, Vitest, Docker, Prettier.
2. **In the VS Code terminal:**
   ```bash
   npm run setup          # installs both services
   npm run db:up          # starts Postgres in Docker (creates the dev and test databases)
   cp services/payments/.env.example services/payments/.env
   cp services/api/.env.example services/api/.env
   ```
   If you ran `db:up` before this version, recreate the database once so the new databases exist: `docker compose down -v && npm run db:up`.
3. **Edit `services/payments/.env` yourself.** Paste your Stripe **sandbox** keys (`sk_test_…`, `pk_test_…`) from Dashboard → Developers → API keys. Never paste keys into Claude.
4. **Run the migrations and tests:**
   ```bash
   npm run db:migrate
   npm test               # payments 61 passed, then api 32 passed
   ```
5. **Connect Stripe tooling:**
   ```bash
   stripe login           # approve in your browser
   stripe agent setup     # adds Stripe's skills to Claude Code
   ```
6. **Start Claude Code** in the project folder (the Claude Code panel in VS Code, or `claude` in the terminal):
   - The first time, approve the **stripe** MCP server and sign in to Stripe in the browser window it opens. Choose your **sandbox**.
   - Try `/test`, then `/stripe-setup`.
7. **Do the Dashboard-only steps** in `docs/STRIPE_DASHBOARD_CHECKLIST.md`. Connect settings come first.

## Everyday commands

```bash
npm run dev            # payments service on http://localhost:3000
npm run dev:api        # core API on http://localhost:3001/v1 (sign-in codes print in this log)
npm run dev:restaurant # restaurant portal on http://localhost:3200
npm run dev:admin      # admin console on http://localhost:3300
npm run dev:customer   # customer web on http://localhost:3100 (copy apps/customer-web/.env.example to .env.local first)
npm run seed:admin -- +19175550123 "Your Name"   # first admin
npm run seed:demo      # demo restaurant "Dhaka Kitchen" with a menu (payments must be running)
npm run stripe:listen  # forward Stripe webhooks to your local payments service
npm test               # all tests (Postgres must be running)
npm run typecheck
```

Couriers default to **mock** mode, so the whole order flow works locally without Uber or DoorDash accounts.

## Deploying

See **`docs/DEPLOYMENT.md`**. In short: one Ubuntu VPS with Docker, `deploy/docker-compose.prod.yml`, three env files, and GitHub Actions deploys every green push to `main`.

In VS Code: **Run and Debug → "Payments: run & debug"**, or open a test file and use **"Payments: debug this test file"**. Tasks for the same commands are under **Terminal → Run Task**.

## Good first prompts for Claude Code

- "Read docs/BUSINESS_MODEL.md and summarise how a $39 order with free delivery is split between the restaurant, Send Koro and the driver."
- "Add the delivery fee share to the delivery price at quote time, with tests." (This is the recommended open item.)
- "Replace the distance estimate in services/api/src/core/geo.ts with the Google Routes API so offer pay matches real trips." 
- "/check-business-rules" before every commit.

## Safety

- **Sandbox first.** Live keys are refused unless you set `ALLOW_LIVE_KEYS=true` on the production server.
- `.env` files are git-ignored, and Claude Code is blocked from reading them.
- Use a **restricted key** in production (permissions are listed in the checklist).
