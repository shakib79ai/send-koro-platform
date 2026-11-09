'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { usePortal } from '@/lib/portal';
import { usd } from '@/lib/money';
import type { Summary } from '@/lib/types';
import { startOfMonth, startOfToday } from '@/lib/dates';

const PERIODS = [
  { key: 'today', label: 'Today', range: () => [startOfToday(), new Date(Date.now() + 60_000)] },
  { key: '7d', label: '7 days', range: () => [new Date(startOfToday().getTime() - 6 * 86_400_000), new Date(Date.now() + 60_000)] },
  { key: 'month', label: 'This month', range: () => [startOfMonth(0), new Date(Date.now() + 60_000)] },
  { key: 'last', label: 'Last month', range: () => [startOfMonth(-1), startOfMonth(0)] },
] as const;

export default function Earnings() {
  const { restaurant } = usePortal();
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['key']>('month');
  const [s, setS] = useState<Summary | null>(null);
  useEffect(() => {
    if (!restaurant) return;
    const [from, to] = PERIODS.find((p) => p.key === period)!.range();
    setS(null);
    api<Summary>(`/restaurant-orders/${restaurant.id}/summary?from=${from.toISOString()}&to=${to.toISOString()}`).then(setS).catch(() => setS(null));
  }, [restaurant, period]);
  if (!restaurant) return null;
  const max = Math.max(1, ...(s?.daily.map((d) => d.foodCents) ?? [1]));

  return (
    <div>
      <div className="page-head">
        <div><h1>Earnings & payouts</h1><p className="small muted" style={{ margin: '4px 0 0' }}>Food payments land in your own Stripe account · $0 commission</p></div>
        <div className="seg">{PERIODS.map((p) => <button key={p.key} className={period === p.key ? 'on' : ''} onClick={() => setPeriod(p.key)}>{p.label}</button>)}</div>
      </div>
      <div className="kpis">
        <div className="kpi"><div className="k">Food sales</div><div className="v">{usd(s?.foodCents ?? 0)}</div><div className="tiny muted">{s?.orders ?? 0} orders</div></div>
        <div className="kpi"><div className="k">Sales tax collected</div><div className="v">{usd(s?.taxCents ?? 0)}</div><div className="tiny muted">Yours to report and pay</div></div>
        <div className="kpi"><div className="k">Delivery you paid</div><div className="v">{usd(s?.deliveryPaidCents ?? 0)}</div><div className="tiny muted">Free-delivery help</div></div>
        <div className="kpi"><div className="k">Commission paid</div><div className="v">$0.00</div><div className="tiny" style={{ color: 'var(--green)' }}>Flat plan instead</div></div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)' }}>
        <div className="card pad">
          <h3>Daily food sales</h3>
          {s && s.daily.length ? <><div className="bars">{s.daily.map((d) => <div key={d.day} title={`${d.day}: ${usd(d.foodCents)} · ${d.orders} orders`} style={{ height: `${(d.foodCents / max) * 100}%` }} />)}</div><div className="row between tiny muted"><span>{s.daily[0].day}</span><span>{s.daily.at(-1)!.day}</span></div></> : <p className="muted small">No sales in this period.</p>}
        </div>
        <div className="card pad stack" style={{ gap: 6 }}>
          <h3>Summary</h3>
          <div className="row between small"><span>Food sales</span><b>{usd(s?.foodCents ?? 0)}</b></div>
          <div className="row between small"><span>Service charges & fees</span><span>{usd(s?.serviceChargeCents ?? 0)}</span></div>
          <div className="row between small"><span>Sales tax collected</span><span>{usd(s?.taxCents ?? 0)}</span></div>
          <div className="row between small"><span>Free-delivery help you paid</span><span>−{usd(s?.deliveryPaidCents ?? 0)}</span></div>
          <div className="row between small"><span>Send Koro commission</span><span>$0.00</span></div>
          <div className="row between small muted"><span>Card processing & refunds</span><span>in Stripe</span></div>
          <hr style={{ border: 0, borderTop: '1px solid var(--line)', width: '100%' }} />
          <p className="tiny muted" style={{ margin: 0 }}>Payouts, card processing (2.9% + 30¢ on food) and refunds are in your Stripe Dashboard. Your plan fee is billed separately. Tips go to couriers and never appear here.</p>
          <a className="btn dark" href="https://dashboard.stripe.com" target="_blank" rel="noreferrer">Open Stripe Dashboard</a>
        </div>
      </div>
    </div>
  );
}
