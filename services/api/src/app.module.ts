import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtService } from '@nestjs/jwt';
import { loadEnv, Env } from './config/env';
import { createDb, Db } from './db/client';
import { TOKENS } from './common/tokens';
import { AuthGuard } from './auth/auth.guard';
import { AuthService } from './auth/auth.service';
import { AuthController } from './auth/auth.controller';
import { ConsoleSms, SmsSender, TwilioSms } from './integrations/sms';
import { ConsolePush, PushSender } from './integrations/push';
import { HttpPaymentsClient, PaymentsClient } from './integrations/payments.client';
import { EventBus } from './realtime/events';
import { RealtimeController } from './realtime/realtime.controller';
import { NotificationsService } from './notifications/notifications.service';
import { CustomersService } from './customers/customers.service';
import { CustomersController } from './customers/customers.controller';
import { RestaurantsService } from './restaurants/restaurants.service';
import { RestaurantsController } from './restaurants/restaurants.controller';
import { MenuService } from './menu/menu.service';
import { MenuController } from './menu/menu.controller';
import { CatalogService } from './catalog/catalog.service';
import { CatalogController } from './catalog/catalog.controller';
import { OrderStateService } from './orders/order-state.service';
import { OrdersService } from './orders/orders.service';
import { CustomerOrdersController, RestaurantOrdersController } from './orders/orders.controller';
import { DispatchService } from './dispatch/dispatch.service';
import { ProviderWebhooksController } from './dispatch/provider-webhooks.controller';
import { buildProviders } from './dispatch/providers';
import { DriversService } from './drivers/drivers.service';
import { DriversController } from './drivers/drivers.controller';
import { AdminService } from './admin/admin.service';
import { AdminController } from './admin/admin.controller';
import { ApiJobs } from './jobs/api.jobs';
import { HealthController } from './health.controller';
import { GeocodeController } from './geocode/geocode.controller';
import type { DeliveryProviderAdapter, ThirdPartyProvider } from './dispatch/providers/types';

type Providers = Partial<Record<ThirdPartyProvider, DeliveryProviderAdapter>>;

/**
 * Explicit factory providers (no reliance on emitDecoratorMetadata), same pattern as the
 * payments service: services are plain classes that tests construct directly.
 */
@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [
    HealthController, GeocodeController, AuthController, CustomersController, RestaurantsController, MenuController, CatalogController,
    CustomerOrdersController, RestaurantOrdersController, DriversController, AdminController, ProviderWebhooksController, RealtimeController,
  ],
  providers: [
    { provide: TOKENS.env, useFactory: () => loadEnv() },
    { provide: TOKENS.db, inject: [TOKENS.env], useFactory: (env: Env) => createDb(env.DATABASE_URL).db },
    { provide: TOKENS.jwt, inject: [TOKENS.env], useFactory: (env: Env) => new JwtService({ secret: env.JWT_SECRET, signOptions: { issuer: 'send-koro' }, verifyOptions: { issuer: 'send-koro' } }) },
    {
      provide: TOKENS.sms, inject: [TOKENS.env],
      useFactory: (env: Env): SmsSender => env.SMS_PROVIDER === 'twilio' ? new TwilioSms(env.TWILIO_ACCOUNT_SID!, env.TWILIO_AUTH_TOKEN!, env.TWILIO_FROM_NUMBER!) : new ConsoleSms(),
    },
    { provide: TOKENS.push, useFactory: (): PushSender => new ConsolePush() },
    { provide: TOKENS.payments, inject: [TOKENS.env], useFactory: (env: Env): PaymentsClient => new HttpPaymentsClient(env.PAYMENTS_URL, env.PAYMENTS_INTERNAL_KEY) },
    { provide: TOKENS.events, useFactory: () => new EventBus() },
    { provide: TOKENS.providers, inject: [TOKENS.env], useFactory: (env: Env) => buildProviders(env) },
    { provide: TOKENS.notifications, inject: [TOKENS.db, TOKENS.events, TOKENS.push], useFactory: (db: Db, ev: EventBus, push: PushSender) => new NotificationsService(db, ev, push) },
    {
      provide: TOKENS.auth, inject: [TOKENS.db, TOKENS.jwt, TOKENS.sms, TOKENS.env],
      useFactory: (db: Db, jwt: JwtService, sms: SmsSender, env: Env) => new AuthService(db, jwt, sms, { accessTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS, refreshTtlDays: env.REFRESH_TOKEN_TTL_DAYS, pepper: env.JWT_SECRET }),
    },
    { provide: TOKENS.customers, inject: [TOKENS.db], useFactory: (db: Db) => new CustomersService(db) },
    { provide: TOKENS.restaurants, inject: [TOKENS.db, TOKENS.payments], useFactory: (db: Db, p: PaymentsClient) => new RestaurantsService(db, p) },
    { provide: TOKENS.menu, inject: [TOKENS.db, TOKENS.restaurants], useFactory: (db: Db, r: RestaurantsService) => new MenuService(db, r) },
    { provide: TOKENS.catalog, inject: [TOKENS.db, TOKENS.menu], useFactory: (db: Db, m: MenuService) => new CatalogService(db, m) },
    { provide: TOKENS.orderState, inject: [TOKENS.db, TOKENS.notifications], useFactory: (db: Db, n: NotificationsService) => new OrderStateService(db, n) },
    {
      provide: TOKENS.dispatch, inject: [TOKENS.db, TOKENS.providers, TOKENS.payments, TOKENS.orderState, TOKENS.notifications, TOKENS.env],
      useFactory: (db: Db, pr: Providers, p: PaymentsClient, s: OrderStateService, n: NotificationsService, env: Env) => new DispatchService(db, pr, p, s, n, env.DISPATCH_ORDER),
    },
    {
      provide: TOKENS.orders, inject: [TOKENS.db, TOKENS.payments, TOKENS.menu, TOKENS.restaurants, TOKENS.dispatch, TOKENS.orderState, TOKENS.notifications, TOKENS.env],
      useFactory: (db: Db, p: PaymentsClient, m: MenuService, r: RestaurantsService, d: DispatchService, s: OrderStateService, n: NotificationsService, env: Env) =>
        new OrdersService(db, p, m, r, d, s, n, { autoDeclineMinutes: env.AUTO_DECLINE_MINUTES }),
    },
    {
      provide: TOKENS.drivers, inject: [TOKENS.db, TOKENS.payments, TOKENS.dispatch, TOKENS.orderState, TOKENS.notifications],
      useFactory: (db: Db, p: PaymentsClient, d: DispatchService, s: OrderStateService, n: NotificationsService) => new DriversService(db, p, d, s, n),
    },
    {
      provide: TOKENS.admin, inject: [TOKENS.db, TOKENS.payments, TOKENS.dispatch, TOKENS.orderState, TOKENS.env],
      useFactory: (db: Db, p: PaymentsClient, d: DispatchService, s: OrderStateService, env: Env) =>
        new AdminService(db, p, d, s, { uberDirect: env.UBER_DIRECT_MODE, doordashDrive: env.DOORDASH_DRIVE_MODE, dispatchOrder: env.DISPATCH_ORDER, sms: env.SMS_PROVIDER, push: env.PUSH_PROVIDER }),
    },
    { provide: APP_GUARD, useClass: AuthGuard },
    ApiJobs,
  ],
})
export class AppModule {}
