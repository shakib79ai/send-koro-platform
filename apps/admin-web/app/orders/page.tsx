'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useData } from '@/lib/admin';
import { usd } from '@/lib/money';
import { Money, PROVIDER, Status, when } from '@/components/bits';
import { MoneyInput, useAction } from '@/components/ui';

interface OrderRow { id: string; code: string; status: string; fulfilment: string; restaurantName: string; totalCents: number; createdAt: string }
interface Detail {
  order: OrderRow & { foodCents: number; serviceChargeCents: number; taxCents: number; tipCents: number; deliveryCents: number; customerDeliveryCents: number; restaurantDeliveryCents: number; items: { name: string; quantity: number }[]; receipt: { lines: { label: string; amountCents: number }[] }; paymentsOrderId: string | null; cancelReason: string | null };
  delivery: { provider: string; status: string; providerDeliveryId: string | null; providerQuoteCents: number | null; driverPayCents: number | null; trackingUrl: string | null } | null;
  events: { id: string; type: string; actor: string; createdAt: string; data: unknown }[];
  offers: { id: string; driverId: string; payCents: number; status: string; createdAt: string }[];
  customer: { name: string | null; phone: string } | null;
}

function OrdersInner() {
  const params = useSearchParams();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const list = useData<OrderRow[]>(`/admin/orders?limit=200${status ? `&status=${status}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`, []);
  const id = params.get('id');
  return (
    <div>
      <div className="page-head"><h1>Orders</h1>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <input className="input" placeholder="Code (SK-…) or order ID" value={search} onChange={(e) => setSearch(e.target.value.trim())} style={{ width: 240 }} />
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 'auto' }}><option value="">All statuses</option>{['placed', 'accepted', 'preparing', 'ready', 'picked_up', 'delivered', 'completed', 'declined', 'cancelled', 'pending_payment'].map((s) => <option key={s}>{s}</option>)}</select>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: id ? 'minmax(0,1fr) minmax(0,1.1fr)' : '1fr' }}>
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="t"><thead><tr><th>Order</th><th>Restaurant</th><th>Status</th><th>Created</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
            <tbody>{(list.data ?? []).map((o) => <tr key={o.id} onClick={() => router.push(`/orders?id=${o.id}`)} style={{ cursor: 'pointer', background: o.id === id ? 'var(--orange-soft)' : undefined }}><td><b>{o.code}</b><div className="tiny muted">{o.fulfilment}</div></td><td className="small">{o.restaurantName}</td><td><Status s={o.status} /></td><td className="small">{when(o.createdAt)}</td><td style={{ textAlign: 'right' }}>{usd(o.totalCents)}</td></tr>)}</tbody>
          </table>
        </div>
        {id && <OrderDetail id={id} onChanged={list.reload} />}
      </div>
    </div>
  );
}

function OrderDetail({ id, onChanged }: { id: string; onChanged: () => void }) {
  const d = useData<Detail>(`/admin/orders/${id}`, [id]);
  const { busy, run, Status: ActionStatus } = useAction();
  const [refund, setRefund] = useState({ foodCents: 0, serviceChargeCents: 0, taxCents: 0, customerDeliveryCents: 0, restoreSubsidyCents: 0, tipCents: 0, reason: '' });
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  useEffect(() => { setRequestId(crypto.randomUUID()); }, [id]);
  if (!d.data) return <div className="card pad muted">{d.error || 'Loading…'}</div>;
  const { order: o, delivery, events, offers, customer } = d.data;
  const total = refund.foodCents + refund.serviceChargeCents + refund.taxCents + refund.customerDeliveryCents + refund.tipCents;

  return (
    <div className="stack">
      <div className="card pad stack" style={{ gap: 8 }}>
        <div className="row between"><h2>{o.code}</h2><Status s={o.status} /></div>
        <div className="small muted">{o.restaurantName} · {customer?.name ?? 'Customer'} {customer?.phone} · {o.fulfilment}{o.cancelReason ? ` · ${o.cancelReason}` : ''}</div>
        <div className="small">{o.items.map((i, k) => <div key={k}>{i.quantity}× {i.name}</div>)}</div>
        <table className="t"><tbody>
          <tr><td>Food / service / tax</td><td style={{ textAlign: 'right' }}><Money c={o.foodCents} /> / <Money c={o.serviceChargeCents} /> / <Money c={o.taxCents} /></td></tr>
          <tr><td>Delivery price (D) · customer (C) · restaurant (R)</td><td style={{ textAlign: 'right' }}><Money c={o.deliveryCents} /> · <Money c={o.customerDeliveryCents} /> · <Money c={o.restaurantDeliveryCents} /></td></tr>
          <tr><td>Tip (100% to courier)</td><td style={{ textAlign: 'right' }}><Money c={o.tipCents} /></td></tr>
          <tr><td><b>Charged to customer</b></td><td style={{ textAlign: 'right' }}><b><Money c={o.totalCents} /></b></td></tr>
        </tbody></table>
      </div>
      <div className="card pad stack" style={{ gap: 8 }}>
        <h3>Delivery</h3>
        {delivery ? <>
          <div className="row between small"><span>Provider</span><b>{PROVIDER[delivery.provider] ?? delivery.provider}</b></div>
          <div className="row between small"><span>Status</span><Status s={delivery.status} /></div>
          {delivery.providerDeliveryId && <div className="row between small"><span>Provider delivery ID</span><code>{delivery.providerDeliveryId}</code></div>}
          {delivery.providerQuoteCents != null && <div className="row between small"><span>Provider quote</span><Money c={delivery.providerQuoteCents} /></div>}
          {delivery.driverPayCents != null && <div className="row between small"><span>Driver locked pay</span><Money c={delivery.driverPayCents} /></div>}
          {delivery.trackingUrl && <a className="link small" href={delivery.trackingUrl} target="_blank" rel="noreferrer">Provider tracking ↗</a>}
        </> : <p className="small muted">{o.fulfilment === 'pickup' ? 'Pickup order.' : 'Not dispatched yet.'}</p>}
        {offers.length > 0 && <div className="tiny muted">{offers.length} driver offer(s): {offers.map((x) => `${x.status} ${usd(x.payCents)}`).join(', ')}</div>}
        {o.fulfilment === 'delivery' && ['accepted', 'preparing', 'ready'].includes(o.status) && <button className="btn sm" disabled={busy} onClick={() => run(async () => { await api(`/admin/orders/${id}/retry-dispatch`, { method: 'POST' }); d.reload(); }, 'Sent to courier company')}>Send to Uber Direct / DoorDash now</button>}
      </div>
      {o.paymentsOrderId && ['accepted', 'preparing', 'ready', 'picked_up', 'delivered', 'completed'].includes(o.status) && (
        <div className="card pad stack">
          <h3>Refund by component</h3>
          <p className="tiny muted" style={{ margin: 0 }}>Refunds go back on the restaurant’s charge. Delivery and tip parts reverse Send Koro’s allocation (capped at what was taken). A tip already paid to a driver can’t be refunded here.</p>
          <div className="form-grid">
            {([['foodCents', 'Food'], ['serviceChargeCents', 'Service charge'], ['taxCents', 'Tax'], ['customerDeliveryCents', 'Customer delivery'], ['restoreSubsidyCents', 'Restore restaurant’s delivery help'], ['tipCents', 'Tip']] as const).map(([k, label]) => (
              <div key={k} className="field"><label>{label}</label><MoneyInput cents={refund[k]} onChange={(c) => setRefund({ ...refund, [k]: c ?? 0 })} /></div>
            ))}
          </div>
          <div className="field"><label>Reason</label><input className="input" value={refund.reason} onChange={(e) => setRefund({ ...refund, reason: e.target.value })} placeholder="Missing item: 1× Garlic Naan" /></div>
          <ActionStatus />
          <button className="btn primary" style={{ alignSelf: 'flex-start' }} disabled={busy || total + refund.restoreSubsidyCents === 0 || refund.reason.length < 3} onClick={() => run(async () => {
            await api(`/admin/orders/${id}/refunds`, { body: { requestId, ...refund } });
            setRequestId(crypto.randomUUID()); d.reload(); onChanged();
          }, 'Refund sent')}>Refund {usd(total)}</button>
        </div>
      )}
      <div className="card pad stack" style={{ gap: 4 }}>
        <h3>Timeline</h3>
        {events.map((e) => <div key={e.id} className="tiny"><span className="muted">{when(e.createdAt)}</span> <b>{e.type}</b> <span className="muted">by {e.actor}</span>{e.data ? <code style={{ marginLeft: 6 }}>{JSON.stringify(e.data).slice(0, 120)}</code> : null}</div>)}
      </div>
    </div>
  );
}

export default function OrdersPage() { return <Suspense><OrdersInner /></Suspense>; }
