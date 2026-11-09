import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TOKENS } from '../tokens';
import { SettlementService } from '../payments/settlement.service';
import { SubscriptionsService } from '../payments/subscriptions.service';

@Injectable()
export class PaymentsJobs {
  private readonly log = new Logger('PaymentsJobs');
  constructor(
    @Inject(TOKENS.subscriptions) private readonly subs: SubscriptionsService,
    @Inject(TOKENS.settlement) private readonly settlement: SettlementService,
  ) {}

  /** 00:30 on the 1st (New York): lock last month's tier before the 12:00 renewal. */
  @Cron('30 0 1 * *', { timeZone: 'America/New_York' })
  async monthlyTiers() {
    const res = await this.subs.runRestaurantTierJob();
    this.log.log(`Tier job: ${res.length} restaurants, ${res.filter((r) => r.changed).length} price changes`);
  }

  /** Every 15 minutes: pay driver transfers that were owed (balance became available, onboarding finished). */
  @Cron('*/15 * * * *')
  async retryDriverTransfers() {
    const res = await this.settlement.retryOwed();
    if (res.length) this.log.log(`Driver transfer retry: ${res.length} attempted`);
  }
}
