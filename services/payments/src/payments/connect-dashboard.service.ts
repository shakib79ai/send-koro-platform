/**
 * The "Stripe" tab for restaurants and drivers: an account session for Stripe's embedded components,
 * and a summary (setup state, what Stripe still needs, payout schedule, bank, balance, payouts and,
 * for drivers, weekly pay statements). Rules for what the components may do: src/core/connect.ts.
 */
import type Stripe from 'stripe';
import { desc, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { drivers, driverTopUps, driverTransfers, restaurants } from '../db/schema';
import { accountSessionComponents, describePayoutSchedule, requirementsDue, weeklyStatement, type PartyKind, type SetupState } from '../core/connect';
import type { ReportsService } from './reports.service';

export class ConnectDashboardService {
  constructor(private readonly stripe: Stripe, private readonly db: Db, private readonly reports: ReportsService) {}

  private async party(kind: PartyKind, id: string) {
    if (kind === 'restaurant') {
      const [r] = await this.db.select({ acct: restaurants.stripeAccountId, status: restaurants.onboardingStatus, active: restaurants.cardPaymentsActive }).from(restaurants).where(eq(restaurants.id, id));
      return r ?? null;
    }
    const [d] = await this.db.select({ acct: drivers.stripeAccountId, status: drivers.onboardingStatus, active: drivers.transfersActive }).from(drivers).where(eq(drivers.id, id));
    return d ?? null;
  }

  /** Client secret for Connect embedded components. Short-lived; the app asks again when it expires. */
  async accountSession(kind: PartyKind, id: string): Promise<{ clientSecret: string; expiresAt: number; stripeAccountId: string } | { clientSecret: null; reason: 'no_account' }> {
    const p = await this.party(kind, id);
    if (!p) throw new Error(`${kind} not found`);
    if (!p.acct) return { clientSecret: null, reason: 'no_account' };
    const s = await this.stripe.accountSessions.create({ account: p.acct, components: accountSessionComponents(kind) });
    return { clientSecret: s.client_secret, expiresAt: s.expires_at, stripeAccountId: p.acct };
  }

  async overview(kind: PartyKind, id: string) {
    const p = await this.party(kind, id);
    if (!p) throw new Error(`${kind} not found`);
    const statement = kind === 'driver' ? await this.driverStatement(id) : undefined;
    if (!p.acct) {
      return { kind, stripeAccountId: null, setup: 'not_started' as SetupState, ready: false, requirementsDue: [], payoutSchedule: null, bank: null, balance: null, payouts: [], statement, error: null };
    }
    let error: string | null = null;
    let due: string[] = [];
    let schedule: string | null = null;
    let bank: { name: string | null; last4: string } | null = null;
    let displayName: string | null = null;
    try {
      const [v2, v1] = await Promise.all([
        this.stripe.v2.core.accounts.retrieve(p.acct, { include: ['requirements', kind === 'restaurant' ? 'configuration.merchant' : 'configuration.recipient'] }),
        this.stripe.accounts.retrieve(p.acct),
      ]);
      displayName = v2.display_name ?? null;
      due = requirementsDue(v2.requirements?.entries as never);
      const sch = v1.settings?.payouts?.schedule;
      schedule = describePayoutSchedule(sch ? { interval: sch.interval, weeklyAnchor: sch.weekly_anchor, monthlyAnchor: sch.monthly_anchor, delayDays: sch.delay_days } : null);
      // Full-Dashboard accounts may not share bank details with the platform; then the app says "In your Stripe account".
      const ext = v1.external_accounts?.data?.[0] as (Stripe.BankAccount | Stripe.Card | undefined);
      if (ext) bank = { name: ext.object === 'bank_account' ? (ext.bank_name ?? null) : (ext.brand ?? null), last4: ext.last4 };
    } catch (e) {
      error = `Stripe didn’t respond: ${(e as Error).message}`;
    }
    const money = await this.reports.accountPayouts(kind, id);
    return {
      kind, stripeAccountId: p.acct, displayName, setup: p.status as SetupState, ready: p.active,
      requirementsDue: due, payoutSchedule: schedule, bank,
      balance: money.balance, payouts: money.payouts, statement, error: error ?? money.error,
    };
  }

  private async driverStatement(driverId: string) {
    const [transfers, topUps] = await Promise.all([
      this.db.select().from(driverTransfers).where(eq(driverTransfers.driverId, driverId)).orderBy(desc(driverTransfers.createdAt)).limit(400),
      this.db.select().from(driverTopUps).where(eq(driverTopUps.driverId, driverId)).orderBy(desc(driverTopUps.createdAt)).limit(20),
    ]);
    return weeklyStatement(transfers, topUps).slice(0, 8);
  }
}
