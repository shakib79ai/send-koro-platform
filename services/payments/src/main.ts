import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

async function bootstrap() {
  const env = loadEnv();
  // rawBody is required for Stripe webhook signature verification.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableShutdownHooks();
  await app.listen(env.PORT);
}
bootstrap();
