'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { liveStream } from '@/lib/api';
import { useData } from '@/lib/admin';
import { usd } from '@/lib/money';
import { Kpi, PROVIDER, Status, when } from '@/components/bits';

interface Overview { orders: number; liveOrders: number; declinedOrders: number; foodSalesCents: number; deliveriesByProvider: { provider: string; n: number }[]; driversOnline: number; driversApproved: number }
interface OrderRow { id: string; code: string; status: string; fulfilment: string; restaurantName: string; totalCents: number; createdAt: string; placedAt: string | null }
interface Event { type: string; data: Record<string, unknown>; at: Date }

export default function Operations() {
  const ov = useData<Overview>('/admin/overview');
  const live = useData<OrderRow[]>('/admin/orders?limit=50');
  const [events, setEvents] = useState<Event[]>([]);
  useEffect(() => {
    const stop = liveStream('/live/admin', (type, data) => {
      setEvents((e) => [{ type, data: data as Record<string, unknown>, at: new Date() }, ...e].slice(0, 30));
      if (type === 'order.updated') { ov.reload(); live.reload(); }
    });
    const t = setInterval(() => { ov.reload(); live.reload(); }, 30_000);
    return () => { stop(); clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const o = ov.data;
  const active = live.data?.filter((x) => ['placed', 'accepted', 'preparing', 'ready', 'picked_up'].includes(x.status)) ?? [];
  const problems = events.filter((e) => e.type === 'delivery.failed' || e.type === 'delivery.problem');

  return (
    <div>
      <div className="page-head"><div><h1>Operations</h1><p className="small muted" style={{ margin: '4px 0 0' }}>Last 24 hours · live</p></div></div>
      <div className="kpis">
        <Kpi k="Orders (24h)" v={o?.orders ?? '—'} sub={`${o?.declinedOrders ?? 0} declined`} />
        <Kpi k="Live right now" v={o?.liveOrders ?? '—'} sub="placed → out for delivery" />
        <Kpi k="Food sales (24h)" v={usd(o?.foodSalesCents ?? 0)} sub="to restaurants · $0 commission" />
        <Kpi k="Drivers online" v={o?.driversOnline ?? '—'} sub={`${o?.driversApproved ?? 0} approved`} />
      </div>
      {problems.length > 0 && <div className="error" style={{ marginBottom: 14 }}>⚠ {problems.length} delivery problem{problems.length > 1 ? 's' : ''}: {problems.map((p) => <Link key={String(p.at.getTime())} className="link" href={`/orders?id=${p.data.orderId}`} style={{ marginLeft: 8 }}>{String(p.data.orderId).slice(0, 8)}</Link>)}</div>}
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)' }}>
        <div className="card">
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}><h3>Active orders</h3></div>
          <table className="t"><thead><tr><th>Order</th><th>Restaurant</th><th>Status</th><th>Placed</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
            <tbody>{active.length ? active.map((r) => <tr key={r.id}><td><Link className="link" href={`/orders?id=${r.id}`}>{r.code}</Link><div className="tiny muted">{r.fulfilment}</div></td><td>{r.restaurantName}</td><td><Status s={r.status} /></td><td className="small">{when(r.placedAt)}</td><td style={{ textAlign: 'right' }}>{usd(r.totalCents)}</td></tr>) : <tr><td colSpan={5} className="muted">No active orders.</td></tr>}</tbody>
          </table>
        </div>
        <div className="stack">
          <div className="card pad stack" style={{ gap: 6 }}>
            <h3>Deliveries by provider (24h)</h3>
            {o?.deliveriesByProvider.length ? o.deliveriesByProvider.map((d) => <div key={d.provider} className="row between small"><span>{PROVIDER[d.provider] ?? d.provider}</span><b>{d.n}</b></div>) : <p className="small muted">None yet.</p>}
          </div>
          <div className="card pad stack" style={{ gap: 6 }}>
            <h3>Live feed</h3>
            {events.length ? events.slice(0, 12).map((e, i) => <div key={i} className="tiny"><span className="muted">{e.at.toLocaleTimeString()}</span> {e.type.replace('.', ' ')} {String(e.data.code ?? e.data.orderId ?? '')} {e.data.status ? <Status s={String(e.data.status)} /> : null}{e.data.provider ? ` · ${PROVIDER[String(e.data.provider)] ?? e.data.provider}` : ''}</div>) : <p className="small muted">Waiting for events…</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
