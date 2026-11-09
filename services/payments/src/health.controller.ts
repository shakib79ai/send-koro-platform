import { Controller, Get, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { TOKENS } from './tokens';
import type { Db } from './db/client';

/** Liveness + database check for Docker and the load balancer. No secrets, no Stripe call. */
@Controller('health')
export class HealthController {
  constructor(@Inject(TOKENS.db) private readonly db: Db) {}
  @Get() async health() { await this.db.execute(sql`select 1`); return { ok: true, service: 'send-koro-payments' }; }
}
