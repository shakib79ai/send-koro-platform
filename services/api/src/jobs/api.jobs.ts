import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, Interval } from '@nestjs/schedule';
import { TOKENS } from '../common/tokens';
import type { OrdersService } from '../orders/orders.service';
import type { DispatchService } from '../dispatch/dispatch.service';
import type { DriversService } from '../drivers/drivers.service';

/** Timers. With several API instances, run jobs on one (set RUN_JOBS=false elsewhere). */
@Injectable()
export class ApiJobs {
  private readonly log = new Logger('Jobs');
  private readonly enabled = process.env.RUN_JOBS !== 'false' && process.env.NODE_ENV !== 'test';
  private running = new Set<string>();

  constructor(
    @Inject(TOKENS.orders) private readonly orders: OrdersService,
    @Inject(TOKENS.dispatch) private readonly dispatch: DispatchService,
    @Inject(TOKENS.drivers) private readonly drivers: DriversService,
  ) {}

  private async once(name: string, fn: () => Promise<unknown>) {
    if (!this.enabled || this.running.has(name)) return;
    this.running.add(name);
    try { const r = await fn(); if (r && Object.values(r as object).some((v) => typeof v === 'number' && v > 0)) this.log.log(`${name}: ${JSON.stringify(r)}`); }
    catch (e) { this.log.error(`${name} failed: ${(e as Error).message}`); }
    finally { this.running.delete(name); }
  }

  @Interval(30_000) autoDecline() { return this.once('autoDecline', () => this.orders.autoDecline()); }
  @Interval(60_000) payments() { return this.once('sweepPendingPayments', () => this.orders.sweepPendingPayments()); }
  @Interval(10_000) offers() { return this.once('dispatchTick', () => this.dispatch.tick()); }
  /** Mondays 06:00 New York: NYC minimum-pay top-ups for last week. */
  @Cron('0 6 * * 1', { timeZone: 'America/New_York' }) topUps() { return this.once('nycTopUps', () => this.drivers.settleLastWeekTopUps()); }
  @Cron(CronExpression.EVERY_HOUR) heartbeat() { return this.once('heartbeat', async () => ({})); }
}
