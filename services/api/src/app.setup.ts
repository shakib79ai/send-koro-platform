import type { INestApplication } from '@nestjs/common';
import type { Env } from './config/env';

/** Shared by main.ts and the HTTP tests so both run the same app configuration. */
export function configureApp(app: INestApplication, env: Env) {
  app.enableCors({ origin: [env.CUSTOMER_WEB_URL, env.RESTAURANT_WEB_URL, env.ADMIN_WEB_URL], credentials: true });
  app.setGlobalPrefix('v1', { exclude: ['health', 'webhooks/(.*)'] });
  app.enableShutdownHooks();
  return app;
}
