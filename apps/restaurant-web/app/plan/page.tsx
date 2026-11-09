'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { usePortal } from '@/lib/portal';
import { usd } from '@/lib/money';
import type { Summary } from '@/lib/types';
import { BANDS, bandFor } from '@/lib/plan';
import { startOfMonth } from '@/lib/dates';


export default function Plan() {
  const { restaurant } = usePortal();
  const [last, setLast] = useState<Summary | null>(null);
  const [month, setMonth] = useState<Summary | null>(null);
  const [calc, setCalc] = useState(800_000);
  useEffect(() => {
    if (!restaurant) return;
    const q = (from: Date, to: Date) => api<Summary>(`/restaurant-orders/${restaurant.id}/summary?from=${from.toISOString()}&to=${to.toISOString()}`);
    q(startOfMonth(-1), startOfMonth(0)).then(setLast).catch(() => undefined);
    q(startOfMonth(0), new Date(Date.now() + 60_000)).then(setMonth).catch(() => undefined);
  }, [restaurant]);
  if (!restaurant) return null;
  const lastBand = bandFor(last?.foodCents ?? 0);
  const firstMonth = new Date(restaurant.createdAt) >= startOfMonth(0);
  const nextBand = bandFor(month?.foodCents ?? 0);
  const commission = Math.round(calc * 0.15);
  const plan = BANDS[bandFor(calc)].priceCents;

  return (
    <div>
      <div className="page-head"><div><h1>Plan & billing</h1><p className="small muted" style={{ margin: '4px 0 0' }}>One flat monthly fee based on last month’s food sales, across all your locations. No commission, ever.</p></div></div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)' }}>
        <div className="card pad stack">
          <span className="small muted">Your plan this month</span>
          <div style={{ fontFamily: 'var(--font-head)', fontSize: 40, fontWeight: 800 }}>{firstMonth ? '$0' : usd(BANDS[lastBand].priceCents).replace('.00', '')}<span className="small muted" style={{ fontFamily: 'var(--font-body)', fontWeight: 500 }}> / month</span></div>
          <span className="small">{firstMonth ? 'Your first month is free.' : `Based on ${usd(last?.foodCents ?? 0)} food sales last month · ${BANDS[lastBand].range} band`}</span>
          <div className="note small">So far this month: <b>{usd(month?.foodCents ?? 0)}</b> → next month’s plan would be <b>{usd(BANDS[nextBand].priceCents)}</b>.{nextBand < BANDS.length - 1 && <> {usd(BANDS[nextBand].upToCents - (month?.foodCents ?? 0))} more before the next band.</>}</div>
          <p className="tiny muted" style={{ margin: 0 }}>First month free for every new restaurant. The band is checked at 12:00 ET on the 1st, after refunds; tips, tax, delivery and service charges don’t count. One plan covers all locations.</p>
        </div>
        <div className="card">
          <table className="t"><thead><tr><th>Food sales last month</th><th>Plan</th><th /></tr></thead>
            <tbody>{BANDS.map((b, i) => <tr key={b.range}><td>{b.range}</td><td><b>{usd(b.priceCents).replace('.00', '')}</b></td><td>{!firstMonth && i === lastBand && <span className="badge orange">Current</span>}</td></tr>)}</tbody>
          </table>
        </div>
        <div className="card pad stack">
          <h3>Savings calculator</h3>
          <p className="small muted" style={{ margin: 0 }}>Pick a monthly food sales amount to compare with a commission-based app.</p>
          <input type="range" min={100_000} max={3_000_000} step={50_000} value={calc} onChange={(e) => setCalc(Number(e.target.value))} style={{ accentColor: 'var(--orange)' }} />
          <div className="row between"><span>Monthly food sales</span><b>{usd(calc)}</b></div>
          <div className="row between small"><span>At a 15% commission</span><span>{usd(commission)}</span></div>
          <div className="row between small"><span>Send Koro plan</span><span>{usd(plan)}</span></div>
          <div className="row between" style={{ color: 'var(--green)' }}><b>You keep extra</b><b>{usd(commission - plan)}</b></div>
        </div>
        <div className="card pad stack">
          <h3>Billing method & invoices</h3>
          <p className="small">Your plan is billed to the card or bank you add in Stripe. Invoices are emailed to {restaurant.contactEmail} and available in your Stripe Dashboard.</p>
          <a className="btn" href="https://dashboard.stripe.com" target="_blank" rel="noreferrer">Open Stripe Dashboard</a>
        </div>
      </div>
    </div>
  );
}
