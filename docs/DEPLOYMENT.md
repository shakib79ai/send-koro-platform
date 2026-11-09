# Deploying Send Koro

One VPS runs everything with Docker: Postgres, the core API, the payments service, nightly backups, and Caddy for automatic HTTPS. GitHub Actions tests every push, builds images, and deploys `main`.

```
Internet ──► Caddy (443, auto-HTTPS) ──┬─► customer-web:3000   sendkoro.com (customer web + PWA)
                                       ├─► restaurant-web:3000 restaurants.sendkoro.com (restaurant portal + PWA)
                                       ├─► admin-web:3000      admin.sendkoro.com (admin console)
                                       ├─► api:3001        api.sendkoro.com: apps, Uber Direct / DoorDash webhooks, live updates
                                       └─► payments:3000   api.sendkoro.com/webhooks/stripe* only (internal API never public)
                         api ──(internal key)──► payments ──► Stripe (direct charges on restaurant accounts)
                         api, payments ──► Postgres 16 (sendkoro_api, sendkoro_payments)
```

## 1. Server (once, about 30 minutes)

1. **Create a VPS:** Ubuntu 24.04, 2 vCPU and 4 GB RAM, in a US East region (DigitalOcean, Hetzner Ashburn, AWS Lightsail and similar all work).
2. **DNS:** add `A` records pointing at the server IP for `api.sendkoro.com`, `sendkoro.com` and `www.sendkoro.com`. Also `restaurants.sendkoro.com` and `admin.sendkoro.com`.
3. **Install Docker and create a deploy user:**
   ```bash
   curl -fsSL https://get.docker.com | sh
   adduser --disabled-password deploy && usermod -aG docker deploy
   mkdir -p /opt/send-koro && chown deploy:deploy /opt/send-koro
   ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
   ```
4. **As `deploy`, clone the repo and create the secret files:**
   ```bash
   su - deploy
   git clone https://github.com/shakib79ai/send-koro-platform.git /opt/send-koro
   cd /opt/send-koro/deploy
   cp env.example .env && cp api.env.example api.env && cp payments.env.example payments.env
   chmod 600 .env api.env payments.env
   nano .env            # domain, email, Postgres password
   nano payments.env    # Stripe SANDBOX keys first, INTERNAL_API_KEY
   nano api.env         # JWT_SECRET, PAYMENTS_INTERNAL_KEY (= INTERNAL_API_KEY), Twilio, Uber Direct
   ```
   Generate random secrets with `openssl rand -base64 48`.
5. **Let the server pull images:** create a GitHub token with `read:packages`, then run `echo <token> | docker login ghcr.io -u shakib79ai --password-stdin`.

## 2. GitHub (once)

In the repository, go to **Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | server IP or hostname |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | a private key whose public key is in `/home/deploy/.ssh/authorized_keys` |

Under the **Variables** tab (not secrets — these are public values baked into the web apps), add:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.sendkoro.com/v1` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` now, `pk_live_…` at launch |
| `NEXT_PUBLIC_RESTAURANT_URL` | `https://restaurants.sendkoro.com` |

Then create an environment named **production** under Settings → Environments. Add yourself as a required reviewer if you want to approve each deploy.

## 3. First deploy

Push to `main`, or run **Actions → Deploy → Run workflow**. CI must be green first. The Deploy workflow:

1. Builds `ghcr.io/shakib79ai/send-koro-platform/api` and `…/payments`.
2. Updates the server: pulls the images and runs `docker compose up -d`. Each container applies its database migrations on start.
3. Checks `https://api.sendkoro.com/health`.

Then create the first admin on the server:

```bash
cd /opt/send-koro/deploy
docker compose -f docker-compose.prod.yml --env-file .env exec api node dist/cli.js create-admin +1917XXXXXXX "Your Name"
```

Sign in to the admin console with that phone number. Further admins can be added from the console.

## 4. Stripe webhooks (sandbox first)

From your laptop, with the **sandbox** key in `services/payments/.env` and `PUBLIC_BASE_URL=https://api.sendkoro.com`:

```bash
npm run stripe:setup
```

It prints three `whsec_…` secrets. Put them in `deploy/payments.env` on the server, then restart: `docker compose -f docker-compose.prod.yml --env-file .env up -d payments`.

## 5. Delivery providers

- **Uber Direct:** add your Uber Direct customer ID, client ID and client secret to `api.env`, and set `UBER_DIRECT_MODE=sandbox`. In the Uber Direct dashboard, set the webhook URL to `https://api.sendkoro.com/webhooks/uber-direct` and copy its signing key into `UBER_DIRECT_WEBHOOK_SECRET`.
- **DoorDash Drive** (once approved): add the developer ID, key ID and signing secret to `api.env`, and set `DOORDASH_DRIVE_MODE=sandbox`. In the DoorDash developer portal, set the webhook to `https://api.sendkoro.com/webhooks/doordash` with an `Authorization` header value, and put that same value in `DOORDASH_WEBHOOK_SECRET`.
- Leave a provider on `mock` until its credentials exist. `live` is refused unless `NODE_ENV=production`.

## 6. Going live (only after the checklist)

1. Finish `docs/STRIPE_DASHBOARD_CHECKLIST.md`, and get Stripe's written answers listed in `services/payments/README.md`.
2. Create a **restricted** live key (`rk_live_…`) with only the permissions in the checklist.
3. In `payments.env`, set `STRIPE_SECRET_KEY=rk_live_…`, `ALLOW_LIVE_KEYS=true`, and the live webhook secrets. To get those secrets, run `npm run stripe:setup -- --live` from a trusted machine.
4. Switch the delivery providers to `live`. Set `SMS_PROVIDER=twilio`; production refuses `console`.
5. Restart: `docker compose -f docker-compose.prod.yml --env-file .env up -d`.

## Everyday operations

| Task | Command (in `/opt/send-koro/deploy`) |
|---|---|
| Status | `docker compose -f docker-compose.prod.yml --env-file .env ps` |
| Logs | `docker compose -f docker-compose.prod.yml --env-file .env logs -f api payments` |
| Restart one service | `docker compose -f docker-compose.prod.yml --env-file .env up -d api` |
| Roll back | set `TAG=<previous commit sha>` in `.env`, then `… pull && … up -d` |
| Backups | `deploy/backups/*.dump` nightly, kept 14 days. **Copy them off the server** (e.g. `rclone` to S3/B2). |
| Restore | `docker compose … exec -T db pg_restore -U sendkoro -d sendkoro_api --clean < backups/sendkoro_api-YYYY-MM-DD.dump` |

## Scaling notes

- Run **one replica of each service.** Jobs run in-process: auto-decline, payment sweep, offer engine, tier job, driver retries and NYC top-ups. To add API replicas, set `RUN_JOBS=false` on the extra ones, and move the event bus (`src/realtime/events.ts`) to Postgres LISTEN/NOTIFY or Redis so live updates reach every replica.
- When traffic grows, move Postgres to a managed service (RDS, Neon, DigitalOcean) and keep the same `DATABASE_URL` shape.
