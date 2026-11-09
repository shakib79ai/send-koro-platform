import 'reflect-metadata';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';
import { configureApp } from './app.setup';

async function bootstrap() {
  const env = loadEnv();
  // rawBody: Uber Direct webhook signatures are computed over the exact bytes.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  configureApp(app, env);
  await app.listen(env.PORT);
}
bootstrap();
