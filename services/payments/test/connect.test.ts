import { describe, expect, it } from 'vitest';
import { accountSessionComponents, describePayoutSchedule, nyWeekStart, requirementsDue, weeklyStatement } from '../src/core/connect';

describe('Connect embedded components rules', () => {
  it('restaurants: payments list without refunds or capture (those go through Send Koro); disputes allowed', () => {
    const c = accountSessionComponents('restaurant');
    expect(c.payments?.features).toEqual({ refund_management: false, capture_payments: false, dispute_management: true, destination_on_behalf_of_charge_management: false });
    expect(c.payment_details?.features?.refund_management).toBe(false);
    expect(c.payouts?.features).toMatchObject({ instant_payouts: false, edit_payout_schedule: true });
  });
  it('drivers: no payments components, no instant payouts, schedule not editable here', () => {
    const c = accountSessionComponents('driver');
    expect(c.payments).toBeUndefined();
    expect(c.payment_details).toBeUndefined();
    expect(c.payouts?.features).toMatchObject({ instant_payouts: false, edit_payout_schedule: false });
    expect(c.documents?.enabled).toBe(true);
  });
});

describe('requirements and payout schedule', () => {
  it('lists only what the user must do now', () => {
    expect(requirementsDue([
      { description: 'Bank account', awaiting_action_from: 'user', minimum_deadline: { status: 'currently_due' } },
      { description: 'ID review', awaiting_action_from: 'stripe', minimum_deadline: { status: 'currently_due' } },
      { description: 'Tax ID', awaiting_action_from: 'user', minimum_deadline: { status: 'eventually_due' } },
      { description: 'Bank account', awaiting_action_from: 'user', minimum_deadline: { status: 'past_due' } },
    ])).toEqual(['Bank account']);
    expect(requirementsDue(undefined)).toEqual([]);
  });
  it('describes schedules in plain words', () => {
    expect(describePayoutSchedule({ interval: 'weekly', weeklyAnchor: 'monday', delayDays: 2 })).toBe('Every Monday (2 days to arrive)');
    expect(describePayoutSchedule({ interval: 'daily', delayDays: 1 })).toBe('Every day (1 day to arrive)');
    expect(describePayoutSchedule({ interval: 'manual' })).toBe('Manual (you start payouts in Stripe)');
    expect(describePayoutSchedule(null)).toBe('Set in your Stripe account');
  });
});

describe('driver weekly statement', () => {
  it('New York weeks start on Monday', () => {
    expect(nyWeekStart(new Date('2026-11-09T04:30:00Z'))).toBe('2026-11-02'); // Sun 11:30 PM ET
    expect(nyWeekStart(new Date('2026-11-09T05:30:00Z'))).toBe('2026-11-09'); // Mon 12:30 AM ET
  });
  it('adds pay, 100% of tips and top-ups; skips failed and reversed; no fee lines', () => {
    const w = weeklyStatement([
      { amountCents: 1220, payCents: 780, tipCents: 440, status: 'paid', createdAt: new Date('2026-11-03T18:00:00Z') },
      { amountCents: 1430, payCents: 1430, tipCents: 0, status: 'paid', createdAt: new Date('2026-11-05T18:00:00Z') },
      { amountCents: 900, payCents: 900, tipCents: 0, status: 'failed', createdAt: new Date('2026-11-05T19:00:00Z') },
      { amountCents: 650, payCents: 650, tipCents: 200, status: 'paid', createdAt: new Date('2026-10-28T18:00:00Z') },
    ], [{ amountCents: 315, weekStart: '2026-11-02', status: 'paid' }]);
    expect(w).toEqual([
      { weekStart: '2026-11-02', trips: 2, payCents: 2210, tipCents: 440, topUpCents: 315, totalCents: 2965 },
      { weekStart: '2026-10-26', trips: 1, payCents: 650, tipCents: 200, topUpCents: 0, totalCents: 850 },
    ]);
  });
});
