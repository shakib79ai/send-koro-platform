'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { useCart } from '@/lib/cart';
import { usd } from '@/lib/money';
import type { Order } from '@/lib/types';

const LIVE = ['placed', 'accepted', 'preparing', 'ready', 'picked_up'];

export default function OrdersPage() {
  const { session, ready } = useSession();
  const { add } = useCart();
  const [orders, setOrders] = useState<Order[] | null>(null);
  useEffect(() => { if (session) api<Order[]>('/orders').then(setOrders).catch(() => setOrders([])); }, [session]);
  if (!ready) return null;
  if (!session) return <div className="container" style={{ paddingTop: 48 }}><div className="card pad center stack" style={{ maxWidth: 420, margin: '0 auto' }}><h2>Your orders</h2><p className="muted">Sign in to see your orders.</p><Link className="btn primary" href="/sign-in?next=/orders">Sign in</Link></div></div>;

  const reorder = (o: Order) => {
    // Prices are re-checked at checkout; sold-out items are flagged there.
    for (const i of o.items) add(o.locationId, o.restaurantName, { itemId: i.itemId, name: i.name, quantity: i.quantity, optionIds: i.options.map((x) => x.id), optionNames: i.options.map((x) => x.name), unitCents: i.unitCents, note: i.note });
  };

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <h1 style={{ fontSize: 30, marginBottom: 16 }}>My orders</h1>
      {!orders ? <div className="skeleton" style={{ height: 120 }} /> : !orders.length ? <div className="card pad center muted">No orders yet. <Link className="link" href="/">Find food</Link></div> : (
        <div className="stack">
          {orders.map((o) => (
            <div key={o.id} className="card pad row between" style={{ flexWrap: 'wrap' }}>
              <Link href={`/orders/${o.id}`} className="stack" style={{ gap: 2 }}>
                <div className="row"><b>{o.restaurantName}</b><span className="tiny muted">{o.code}</span>{LIVE.includes(o.status) ? <span className="badge orange">{o.statusText}</span> : <span className="badge gray">{o.statusText}</span>}</div>
                <span className="small muted">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</span>
                <span className="tiny muted">{new Date(o.createdAt).toLocaleString()} · {usd(o.totalCents)}</span>
              </Link>
              {!LIVE.includes(o.status) && <Link href={`/restaurants/${o.locationId}`} className="btn sm" onClick={() => reorder(o)}>Reorder</Link>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
