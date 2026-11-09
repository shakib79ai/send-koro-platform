/**
 * Stripe Connect "dashboard" rules for the restaurant portal and the driver app. Pure, no I/O.
 *
 * Restaurants and drivers each have their own connected account with the full Stripe Dashboard
 * (BUSINESS_MODEL.md → Stripe configuration). Inside our apps we show Stripe's embedded components
 * plus a summary we build ourselves. What the embedded components may do follows our money rules:
 *   - Refunds go through Send Koro only, so the application fee is refunded correctly
 *     (src/core/refunds.ts). The embedded payments list therefore has refund_management off.
 *   - Capture happens when the restaurant accepts the order (checkout.service.ts), never from Stripe UI.
 *   - Disputes on a direct charge are the restaurant's, so restaurants may answer them.
 *   - Instant payouts are off at launch for everyone.
 *   - Drivers take no card payments: no payments list for them.
 * Accounts with the full Stripe Dashboard always ask the user to sign in to Stripe for sensitive
 * actions (bank details, payout schedule); that can't be turned off and we don't try.
 */
import type Stripe from 'stripe';

export type PartyKind = 'restaurant' | 'driver';

export function accountSessionComponents(kind: PartyKind): Stripe.AccountSessionCreateParams.Components {
  const payoutFeatures = { instant_payouts: false, standard_payouts: true, edit_payout_schedule: kind === 'restaurant', external_account_collection: true };
  const common: Stripe.AccountSessionCreateParams.Components = {
    account_onboarding: { enabled: true, features: { external_account_collection: true } },
    account_management: { enabled: true, features: { external_account_collection: true } },
    notification_banner: { enabled: true, features: { external_account_collection: true } },
    balances: { enabled: true, features: payoutFeatures },
    payouts: { enabled: true, features: payoutFeatures },
    payouts_list: { enabled: true },
    payout_details: { enabled: true },
    documents: { enabled: true },
  };
  if (kind === 'driver') return common;
  const paymentFeatures = { refund_management: false, capture_payments: false, dispute_management: true, destination_on_behalf_of_charge_management: false };
  return {
    ...common,
    payments: { enabled: true, features: paymentFeatures },
    payment_details: { enabled: true, features: paymentFeatures },
    payment_disputes: { enabled: true, features: { refund_management: false, dispute_management: true, destination_on_behalf_of_charge_management: false } },
    disputes_list: { enabled: true, features: { refund_management: false, dispute_management: true, capture_payments: false, destination_on_behalf_of_charge_management: false } },
  };
}

export type SetupState = 'not_started' | 'pending' | 'restricted' | 'active';

export interface RequirementEntry { description?: string | null; awaiting_action_from?: string | null; minimum_deadline?: { status?: string | null } | null }

/** What the user still has to give Stripe (only items waiting on them, due now or overdue). */
export function requirementsDue(entries: RequirementEntry[] | null | undefined): string[] {
  return (entries ?? [])
    .filter((e) => (e.awaiting_action_from ?? 'user') === 'user')
    .filter((e) => e.minimum_deadline?.status === 'currently_due' || e.minimum_deadline?.status === 'past_due')
    .map((e) => e.description || 'More information')
    .filter((d, i, all) => all.indexOf(d) === i);
}

export interface PayoutSchedule { interval: string; weeklyAnchor?: string | null; monthlyAnchor?: number | null; delayDays?: number | null }

/** "Every Monday", "Every day (2 business days to arrive)", "Monthly on the 1st", "Manual". */
export function describePayoutSchedule(s: PayoutSchedule | null | undefined): string {
  if (!s) return 'Set in your Stripe account';
  const delay = s.delayDays ? ` (${s.delayDays} day${s.delayDays === 1 ? '' : 's'} to arrive)` : '';
  switch (s.interval) {
    case 'daily': return `Every day${delay}`;
    case 'weekly': return `Every ${s.weeklyAnchor ? s.weeklyAnchor[0].toUpperCase() + s.weeklyAnchor.slice(1) : 'week'}${delay}`;
    case 'monthly': return `Monthly on day ${s.monthlyAnchor ?? 1}${delay}`;
    case 'manual': return 'Manual (you start payouts in Stripe)';
    default: return 'Set in your Stripe account';
  }
}

export interface StatementTransfer { amountCents: number; payCents: number; tipCents: number; status: string; createdAt: Date }
export interface StatementTopUp { amountCents: number; weekStart: string; status: string }
export interface StatementWeek { weekStart: string; trips: number; payCents: number; tipCents: number; topUpCents: number; totalCents: number }

/** Monday (YYYY-MM-DD) of the New York week that contains `at`. */
export function nyWeekStart(at: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday'));
  const d = new Date(Date.UTC(+get('year'), +get('month') - 1, +get('day')));
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

/**
 * Driver weekly statement: locked pay, 100% of tips and NYC minimum top-ups, per Monday-to-Sunday week.
 * No fee lines (drivers never pay fees). Failed and reversed transfers are left out.
 */
export function weeklyStatement(transfers: StatementTransfer[], topUps: StatementTopUp[]): StatementWeek[] {
  const weeks = new Map<string, StatementWeek>();
  const week = (k: string) => {
    let w = weeks.get(k);
    if (!w) { w = { weekStart: k, trips: 0, payCents: 0, tipCents: 0, topUpCents: 0, totalCents: 0 }; weeks.set(k, w); }
    return w;
  };
  for (const t of transfers) {
    if (t.status === 'failed' || t.status === 'reversed') continue;
    const w = week(nyWeekStart(t.createdAt));
    w.trips += 1; w.payCents += t.payCents; w.tipCents += t.tipCents; w.totalCents += t.payCents + t.tipCents;
  }
  for (const u of topUps) {
    if (u.status === 'failed' || u.status === 'reversed') continue;
    const w = week(u.weekStart);
    w.topUpCents += u.amountCents; w.totalCents += u.amountCents;
  }
  return [...weeks.values()].sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}
