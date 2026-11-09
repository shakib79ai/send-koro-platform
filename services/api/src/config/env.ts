import { z } from 'zod';

const mode = z.enum(['mock', 'sandbox', 'live']);

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  SMS_PROVIDER: z.enum(['console', 'twilio']).default('console'),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_FROM_NUMBER: z.string().optional(),
  PAYMENTS_URL: z.string().url(),
  PAYMENTS_INTERNAL_KEY: z.string().min(8),
  UBER_DIRECT_MODE: mode.default('mock'),
  UBER_DIRECT_CUSTOMER_ID: z.string().optional(),
  UBER_DIRECT_CLIENT_ID: z.string().optional(),
  UBER_DIRECT_CLIENT_SECRET: z.string().optional(),
  DOORDASH_DRIVE_MODE: mode.default('mock'),
  DOORDASH_DEVELOPER_ID: z.string().optional(),
  DOORDASH_KEY_ID: z.string().optional(),
  DOORDASH_SIGNING_SECRET: z.string().optional(),
  DISPATCH_ORDER: z.string().default('own_driver,uber_direct,doordash_drive'),
  PUSH_PROVIDER: z.enum(['console', 'fcm']).default('console'),
  CUSTOMER_WEB_URL: z.string().url().default('http://localhost:3100'),
  RESTAURANT_WEB_URL: z.string().url().default('http://localhost:3200'),
  ADMIN_WEB_URL: z.string().url().default('http://localhost:3300'),
  /** Minutes before an unanswered order is declined and the card hold released. */
  AUTO_DECLINE_MINUTES: z.coerce.number().int().positive().default(5),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error('Invalid environment:\n' + parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n'));
  }
  const env = parsed.data;
  if (env.NODE_ENV !== 'production' && (env.UBER_DIRECT_MODE === 'live' || env.DOORDASH_DRIVE_MODE === 'live')) {
    throw new Error('Live delivery providers are only allowed with NODE_ENV=production.');
  }
  if (env.NODE_ENV === 'production' && env.SMS_PROVIDER === 'console') {
    throw new Error('SMS_PROVIDER=console prints sign-in codes to the log and is not allowed in production.');
  }
  return env;
}
