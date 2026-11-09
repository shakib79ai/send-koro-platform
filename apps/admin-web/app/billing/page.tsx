'use client';
import { useData } from '@/lib/admin';
import { Kpi, Money, PROVIDER, Status } from '@/components/bits';
import { RangePicker, useRange } from '@/components/Range';

interface Overview { paidOrders: number; volumeCents: number; tipCents: number; applicationFeeCents: number; deliveryFeeShareCents: number; commissionCents: number; refunds: { applicationFeeCents: number }; driverTransfers: { status: string; count: number; cents: number }[]; supplierObligations: { provider: string; status: string; count: number; quotedCents: number; tipCents: number }[] }
interface Sub { restaurantId: string; restaurantName: string; status: string; stripeSubscriptionId: string; latestTier: { period: string; netBaseCents: number; priceLookupKey: string } | null }

export default function Billing() {
  const { range, setRange, query } = useRange();
  const ov = useData<Overview>(`/admin/money/overview?${query}`);
  const subs = useData<Sub[]>('/admin/money/billing');
  const o = ov.data;
  const driversPaid = o?.driverTransfers.filter((t) => t.status === 'paid').reduce((a, t) => a + t.cents, 0) ?? 0;
  const supplierCost = o?.supplierObligations.reduce((a, s) => a + s.quotedCents + s.tipCents, 0) ?? 0;
  const allocation = (o?.applicationFeeCents ?? 0) - (o?.refunds.applicationFeeCents ?? 0);
  return (
    <div>
      <div className="page-head"><div><h1>Billing & platform money</h1><p className="small muted" style={{ margin: '4px 0 0' }}>Send Koro’s money is the delivery allocation (application fee = delivery + tip − its processing share) and restaurant plans. Never a food commission.</p></div><RangePicker value={range} onChange={setRange} /></div>
      {ov.error && <div className="error">{ov.error}</div>}
      <div className="kpis">
        <Kpi k="Delivery allocation received" v={<Money c={allocation} />} sub="application fees, net of refunds" />
        <Kpi k="Paid to own drivers" v={<Money c={driversPaid} />} sub="locked pay + tips" />
        <Kpi k="Owed to courier companies" v={<Money c={supplierCost} />} sub="quotes + tips (by invoice)" />
        <Kpi k="Delivery margin (est.)" v={<Money c={allocation - driversPaid - supplierCost} />} sub="before NYC top-ups" />
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', marginBottom: 16 }}>
        <div className="card pad stack" style={{ gap: 6 }}>
          <h3>Breakdown</h3>
          <div className="row between small"><span>Orders paid</span><b>{o?.paidOrders ?? 0}</b></div>
          <div className="row between small"><span>Charged on restaurant accounts</span><Money c={o?.volumeCents} /></div>
          <div className="row between small"><span>Tips (100% to couriers)</span><Money c={o?.tipCents} /></div>
          <div className="row between small"><span>Processing share borne by delivery</span><Money c={o?.deliveryFeeShareCents} /></div>
          <div className="row between small"><span>Food commission</span><b>$0.00</b></div>
        </div>
        <div className="card pad stack" style={{ gap: 6 }}>
          <h3>Courier companies</h3>
          {o?.supplierObligations.length ? o.supplierObligations.map((s, i) => <div key={i} className="row between small"><span>{PROVIDER[s.provider]} · <Status s={s.status} /></span><span>{s.count} · <Money c={s.quotedCents + s.tipCents} /></span></div>) : <p className="small muted">None in this period.</p>}
        </div>
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}><h3>Restaurant plans</h3></div>
        <table className="t"><thead><tr><th>Restaurant</th><th>Subscription</th><th>Last tier period</th><th>Net food sales</th><th>Plan</th></tr></thead>
          <tbody>{(subs.data ?? []).map((s) => <tr key={s.restaurantId}><td>{s.restaurantName}</td><td><Status s={s.status} /> <span className="tiny muted">{s.stripeSubscriptionId}</span></td><td>{s.latestTier?.period ?? '—'}</td><td><Money c={s.latestTier?.netBaseCents} /></td><td className="small">{s.latestTier?.priceLookupKey ?? 'first month free'}</td></tr>)}
            {!subs.data?.length && <tr><td colSpan={5} className="muted">No plans yet. A plan starts when a restaurant goes live.</td></tr>}</tbody>
        </table>
      </div>
    </div>
  );
}
