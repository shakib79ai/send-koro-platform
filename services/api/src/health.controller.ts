import { Controller, Get, Inject } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Public } from './auth/auth.guard';
import { TOKENS } from './common/tokens';
import type { Db } from './db/client';

@Public()
@Controller('health')
export class HealthController {
  constructor(@Inject(TOKENS.db) private readonly db: Db) {}
  @Get() async health() { await this.db.execute(sql`select 1`); return { ok: true, service: 'send-koro-api' }; }
}
