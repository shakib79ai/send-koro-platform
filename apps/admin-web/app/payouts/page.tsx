'use client';
import Link from 'next/link';
import { useData } from '@/lib/admin';
import { Kpi, Money, Status } from '@/components/bits';
import { RangePicker, useRange } from '@/components/Range';

interface R { id: string; name: string; status: string; payoutsReady: boolean }
interface Overview { paidOrders: number; volumeCents: number; foodCents: number; taxCents: number; tipCents: number; applicationFeeCents: number; refunds: { count: number; chargeCents: number } }

export default function Payouts() {
  const { range, setRange, query } = useRange();
  const ov = useData<Overview>(`/admin/money/overview?${query}`);
  const list = useData<R[]>('/admin/restaurants');
  const o = ov.data;
  return (
    <div>
      <div className="page-head"><div><h1>Restaurant payouts</h1><p className="small muted" style={{ margin: '4px 0 0' }}>Food payments are direct charges on each restaurant’s own Stripe account. Stripe pays them out; Send Koro never holds food money.</p></div><RangePicker value={range} onChange={setRange} /></div>
      {ov.error && <div className="error">{ov.error}</div>}
      <div className="kpis">
        <Kpi k="Charged on restaurant accounts" v={<Money c={o?.volumeCents} />} sub={`${o?.paidOrders ?? 0} paid orders`} />
        <Kpi k="Food sales" v={<Money c={o?.foodCents} />} sub="$0 commission" />
        <Kpi k="Sales tax (restaurants remit)" v={<Money c={o?.taxCents} />} sub="never collected by Send Koro" />
        <Kpi k="Refunds" v={<Money c={o?.refunds.chargeCents} />} sub={`${o?.refunds.count ?? 0} refunds`} />
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="t"><thead><tr><th>Restaurant</th><th>Status</th><th>Stripe account</th><th /></tr></thead>
          <tbody>{(list.data ?? []).map((r) => <tr key={r.id}><td><b>{r.name}</b></td><td><Status s={r.status} /></td><td>{r.payoutsReady ? <Status s="active" /> : <Status s="pending" />}</td><td><Link className="btn sm" href={`/payouts/${r.id}`}>Sales, refunds & payouts →</Link></td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
