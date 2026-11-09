'use client';
import Link from 'next/link';
import { use } from 'react';
import { useData } from '@/lib/admin';
import { Kpi, Money, PROVIDER, Status, when } from '@/components/bits';
import { RangePicker, useRange } from '@/components/Range';

interface MoneyView {
  restaurant: { id: string; name: string; stripeAccountId: string | null; onboardingStatus: string; cardPaymentsActive: boolean };
  ledger: Record<string, number>;
  transactions: { orderId: string; status: string; createdAt: string; paidAt: string | null; paymentIntentId: string | null; totalCents: number; foodCents: number; taxCents: number; tipCents: number; deliveryCents: number; restaurantDeliveryCents: number; applicationFeeCents: number | null; deliveryFeeShareCents: number | null; stripeFeeCents: number | null; cardCountry: string | null; provider: string }[];
  refunds: { id: string; orderId: string; createdAt: string; chargeRefundCents: number; applicationFeeRefundCents: number; status: string }[];
}
interface PayoutsView { error: string | null; stripeAccountId: string | null; balance: { availableCents: number; pendingCents: number } | null; payouts: { id: string; amountCents: number; status: string; arrivalDate: string; failureMessage: string | null }[] }

export default function RestaurantMoney({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { range, setRange, query } = useRange();
  const m = useData<MoneyView>(`/admin/money/restaurants/${id}?${query}`);
  const p = useData<PayoutsView>(`/admin/money/restaurants/${id}/payouts`);
  const l = m.data?.ledger ?? {};
  const refunded = (l.refund_food ?? 0) + (l.refund_service ?? 0) + (l.refund_tax ?? 0);
  return (
    <div>
      <div className="page-head">
        <div><Link className="link small" href="/payouts">← Restaurant payouts</Link><h1>{m.data?.restaurant.name ?? '…'}</h1><p className="small muted" style={{ margin: '4px 0 0' }}>Stripe account <code>{m.data?.restaurant.stripeAccountId ?? 'not connected'}</code> · {m.data?.restaurant.onboardingStatus}</p></div>
        <RangePicker value={range} onChange={setRange} />
      </div>
      {(m.error || p.error) && <div className="error" style={{ marginBottom: 12 }}>{m.error || p.error}</div>}
      <div className="kpis">
        <Kpi k="Food sales" v={<Money c={l.restaurant_food ?? 0} />} sub="kept 100% · $0 commission" />
        <Kpi k="Tax collected (theirs)" v={<Money c={l.restaurant_tax ?? 0} />} />
        <Kpi k="Card processing (Stripe)" v={<Money c={Math.abs(l.stripe_fee_restaurant ?? 0)} />} sub="paid by restaurant on food" />
        <Kpi k="Refunded" v={<Money c={Math.abs(refunded)} />} sub={`${m.data?.refunds.length ?? 0} refunds`} />
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', marginBottom: 16 }}>
        <div className="card pad stack" style={{ gap: 6 }}>
          <h3>Balance & payouts (from Stripe)</h3>
          {p.data?.error && <div className="note small">{p.data.error}</div>}
          {p.data?.balance ? <><div className="row between small"><span>Available</span><b><Money c={p.data.balance.availableCents} /></b></div><div className="row between small"><span>Pending</span><Money c={p.data.balance.pendingCents} /></div></> : <p className="small muted">{!p.data ? 'Loading…' : p.data.error ? '' : 'Stripe account not connected yet.'}</p>}
          {p.data?.payouts.map((x) => <div key={x.id} className="row between small"><span>{new Date(x.arrivalDate).toLocaleDateString()} <span className="muted">{x.id}</span></span><span><Money c={x.amountCents} /> <Status s={x.status} /></span></div>)}
        </div>
        <div className="card pad stack" style={{ gap: 6 }}>
          <h3>Ledger in this period</h3>
          {Object.entries(l).sort().map(([k, v]) => <div key={k} className="row between small"><span className="muted">{k.replace(/_/g, ' ')}</span><Money c={v} /></div>)}
          {!Object.keys(l).length && <p className="small muted">No entries.</p>}
        </div>
      </div>
      <div className="card" style={{ overflowX: 'auto', marginBottom: 16 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}><h3>Transactions</h3></div>
        <table className="t"><thead><tr><th>Created</th><th>Status</th><th>Charge</th><th>Food</th><th>Tax</th><th>Delivery (R)</th><th>Tip</th><th>App fee</th><th>Fee share</th><th>Courier</th><th>PaymentIntent</th></tr></thead>
          <tbody>{(m.data?.transactions ?? []).map((t) => <tr key={t.orderId}><td className="small">{when(t.createdAt)}</td><td><Status s={t.status} /></td><td><Money c={t.totalCents} /></td><td><Money c={t.foodCents} /></td><td><Money c={t.taxCents} /></td><td><Money c={t.restaurantDeliveryCents} /></td><td><Money c={t.tipCents} /></td><td><Money c={t.applicationFeeCents} /></td><td><Money c={t.deliveryFeeShareCents} /></td><td className="small">{PROVIDER[t.provider] ?? t.provider}</td><td className="tiny"><code>{t.paymentIntentId}</code></td></tr>)}</tbody>
        </table>
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}><h3>Refunds</h3></div>
        <table className="t"><thead><tr><th>When</th><th>Order</th><th>On the charge</th><th>App fee returned</th><th>Status</th></tr></thead>
          <tbody>{(m.data?.refunds ?? []).map((r) => <tr key={r.id}><td className="small">{when(r.createdAt)}</td><td className="tiny"><code>{r.orderId.slice(0, 8)}</code></td><td><Money c={r.chargeRefundCents} /></td><td><Money c={r.applicationFeeRefundCents} /></td><td><Status s={r.status} /></td></tr>)}
            {!m.data?.refunds.length && <tr><td colSpan={5} className="muted">No refunds.</td></tr>}</tbody>
        </table>
      </div>
    </div>
  );
}
