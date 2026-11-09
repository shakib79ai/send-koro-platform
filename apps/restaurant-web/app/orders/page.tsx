'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { usePortal } from '@/lib/portal';
import { usd } from '@/lib/money';
import type { LiveOrder } from '@/lib/types';

const STATUS: Record<string, [string, string]> = {
  placed: ['New', 'orange'], accepted: ['Accepted', 'orange'], preparing: ['Preparing', 'orange'], ready: ['Ready', 'orange'], picked_up: ['Out for delivery', 'orange'],
  delivered: ['Delivered', 'green'], completed: ['Picked up', 'green'], declined: ['Declined', 'gray'], cancelled: ['Cancelled', 'gray'],
};
const day = (d: Date) => d.toISOString().slice(0, 10);

export default function History() {
  const { restaurant } = usePortal();
  const [from, setFrom] = useState(day(new Date(Date.now() - 7 * 86_400_000)));
  const [to, setTo] = useState(day(new Date()));
  const [rows, setRows] = useState<LiveOrder[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!restaurant) return;
    setRows(null);
    setRows(await api<LiveOrder[]>(`/restaurant-orders/${restaurant.id}/history?from=${new Date(`${from}T00:00:00`).toISOString()}&to=${new Date(`${to}T23:59:59`).toISOString()}&limit=500`).catch(() => []));
  }, [restaurant, from, to]);
  useEffect(() => { void load(); }, [load]);

  const csv = () => {
    if (!rows) return;
    const head = ['Order', 'Placed', 'Status', 'Type', 'Items', 'Food', 'Service charge', 'Tax', 'Delivery you paid'];
    const lines = rows.map((o) => [o.code, o.placedAt ?? '', STATUS[o.status]?.[0] ?? o.status, o.fulfilment, o.items.map((i) => `${i.quantity}x ${i.name}`).join('; '), (o.foodCents / 100).toFixed(2), (o.serviceChargeCents / 100).toFixed(2), (o.taxCents / 100).toFixed(2), (o.restaurantDeliveryCents / 100).toFixed(2)]);
    const text = [head, ...lines].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); a.download = `send-koro-orders-${from}-to-${to}.csv`; a.click();
  };

  return (
    <div>
      <div className="page-head">
        <h1>Order history</h1>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={{ width: 'auto' }} />
          <span className="muted">to</span>
          <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} style={{ width: 'auto' }} />
          <button className="btn" onClick={csv} disabled={!rows?.length}>Export CSV</button>
        </div>
      </div>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="t">
          <thead><tr><th>Order</th><th>Placed</th><th>Status</th><th>Items</th><th style={{ textAlign: 'right' }}>Food</th><th style={{ textAlign: 'right' }}>Tax</th><th style={{ textAlign: 'right' }}>Delivery you paid</th></tr></thead>
          <tbody>
            {!rows ? <tr><td colSpan={7} className="muted">Loading…</td></tr> : !rows.length ? <tr><td colSpan={7} className="muted">No orders in this period.</td></tr> : rows.map((o) => (
              <tr key={o.id} onClick={() => setOpen(open === o.id ? null : o.id)} style={{ cursor: 'pointer' }}>
                <td><b>{o.code}</b><div className="tiny muted">{o.fulfilment === 'delivery' ? 'Delivery' : 'Pickup'}</div></td>
                <td className="small">{o.placedAt ? new Date(o.placedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}</td>
                <td><span className={`badge ${STATUS[o.status]?.[1] ?? 'gray'}`}>{STATUS[o.status]?.[0] ?? o.status}</span></td>
                <td className="small">{open === o.id ? o.items.map((i, k) => <div key={k}>{i.quantity}× {i.name}{i.options.length ? ` · ${i.options.map((x) => x.name).join(', ')}` : ''}</div>) : `${o.items.reduce((a, i) => a + i.quantity, 0)} items`}</td>
                <td style={{ textAlign: 'right' }}>{usd(o.foodCents)}</td>
                <td style={{ textAlign: 'right' }}>{usd(o.taxCents)}</td>
                <td style={{ textAlign: 'right' }}>{o.restaurantDeliveryCents ? usd(o.restaurantDeliveryCents) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tiny muted">Refunds and card processing appear in your Stripe Dashboard. Tips go to couriers and never appear here.</p>
    </div>
  );
}
