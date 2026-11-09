import { Logger, Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import type Stripe from 'stripe';
import { loadEnv, Env } from './config/env';
import { createDb, Db } from './db/client';
import { createStripe } from './stripe/stripe.client';
import { TOKENS } from './tokens';
import { CheckoutService } from './payments/checkout.service';
import { LedgerService } from './payments/ledger.service';
import { OnboardingService } from './payments/onboarding.service';
import { PaymentsController } from './payments/payments.controller';
import { RefundsService } from './payments/refunds.service';
import { SettlementService } from './payments/settlement.service';
import { SubscriptionsService } from './payments/subscriptions.service';
import { WebhooksController } from './webhooks/webhooks.controller';
import { WebhooksService } from './webhooks/webhooks.service';
import { PaymentsJobs } from './jobs/payments.jobs';
import { RegistryService } from './payments/registry.service';
import { HealthController } from './health.controller';
import { ReportsService } from './payments/reports.service';
import { ConnectDashboardService } from './payments/connect-dashboard.service';
import { ReportsController } from './payments/reports.controller';

const log = new Logger('Payments');

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [PaymentsController, ReportsController, WebhooksController, HealthController],
  providers: [
    { provide: TOKENS.env, useFactory: () => loadEnv() },
    { provide: TOKENS.stripe, useFactory: (env: Env) => createStripe(env.STRIPE_SECRET_KEY), inject: [TOKENS.env] },
    { provide: TOKENS.db, useFactory: (env: Env) => createDb(env.DATABASE_URL).db, inject: [TOKENS.env] },
    { provide: TOKENS.reports, useFactory: (s: Stripe, db: Db) => new ReportsService(s, db), inject: [TOKENS.stripe, TOKENS.db] },
    { provide: TOKENS.connectDashboard, useFactory: (s: Stripe, db: Db, r: ReportsService) => new ConnectDashboardService(s, db, r), inject: [TOKENS.stripe, TOKENS.db, TOKENS.reports] },
    { provide: TOKENS.registry, useFactory: (db: Db) => new RegistryService(db), inject: [TOKENS.db] },
    { provide: TOKENS.ledger, useFactory: (s: Stripe, db: Db) => new LedgerService(s, db), inject: [TOKENS.stripe, TOKENS.db] },
    {
      provide: TOKENS.onboarding, inject: [TOKENS.stripe, TOKENS.db, TOKENS.env],
      useFactory: (s: Stripe, db: Db, env: Env) => new OnboardingService(s, db, { restaurantPortalUrl: env.RESTAURANT_PORTAL_URL, driverAppUrl: env.DRIVER_APP_URL, paymentMethodDomain: env.PAYMENT_METHOD_DOMAIN }),
    },
    {
      provide: TOKENS.checkout, inject: [TOKENS.stripe, TOKENS.db, TOKENS.env],
      useFactory: (s: Stripe, db: Db, env: Env) => new CheckoutService(s, db, { bps: env.EST_STRIPE_FEE_BPS, fixedCents: env.EST_STRIPE_FEE_FIXED_CENTS }, undefined, {
        enabled: env.DELIVERY_MARKUP,
        ownDriver: { bps: env.OWN_DRIVER_PAYOUT_FEE_BPS, fixedCents: env.OWN_DRIVER_PAYOUT_FEE_CENTS },
        thirdParty: { bps: env.THIRD_PARTY_PAYMENT_FEE_BPS, fixedCents: env.THIRD_PARTY_PAYMENT_FEE_CENTS },
      }),
    },
    { provide: TOKENS.refunds, inject: [TOKENS.stripe, TOKENS.db, TOKENS.ledger], useFactory: (s: Stripe, db: Db, l: LedgerService) => new RefundsService(s, db, l) },
    { provide: TOKENS.settlement, inject: [TOKENS.stripe, TOKENS.db, TOKENS.ledger], useFactory: (s: Stripe, db: Db, l: LedgerService) => new SettlementService(s, db, l) },
    {
      provide: TOKENS.subscriptions, inject: [TOKENS.stripe, TOKENS.db, TOKENS.ledger, TOKENS.env],
      useFactory: (s: Stripe, db: Db, l: LedgerService, env: Env) => new SubscriptionsService(s, db, l, { firstMonthFree: env.FIRST_MONTH_FREE, alert: (m, d) => log.error(m, JSON.stringify(d)) }),
    },
    {
      provide: TOKENS.webhooks,
      inject: [TOKENS.stripe, TOKENS.db, TOKENS.env, TOKENS.ledger, TOKENS.settlement, TOKENS.subscriptions, TOKENS.onboarding],
      useFactory: (s: Stripe, db: Db, env: Env, l: LedgerService, st: SettlementService, sub: SubscriptionsService, ob: OnboardingService) =>
        new WebhooksService(s, db, { platform: env.STRIPE_WEBHOOK_SECRET, connect: env.STRIPE_CONNECT_WEBHOOK_SECRET, thin: env.STRIPE_THIN_EVENTS_SECRET }, l, st, sub, ob,
          // Hand-off to dispatch (Uber Direct / DoorDash Drive / own drivers) — wire to your queue.
          async (orderId) => log.log(`Order ${orderId} paid → start fulfilment`)),
    },
    PaymentsJobs,
  ],
})
export class AppModule {}
