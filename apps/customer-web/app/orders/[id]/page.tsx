'use client';
import Link from 'next/link';
import { use, useCallback, useEffect, useState } from 'react';
import { api, ApiError, liveStream } from '@/lib/api';
import { useSession } from '@/lib/session';
import type { Order } from '@/lib/types';
import { Receipt } from '@/components/Receipt';

const DELIVERY_STEPS = [['placed', 'Order sent to the restaurant'], ['accepted', 'Restaurant accepted · card charged'], ['preparing', 'Preparing your food'], ['picked_up', 'On the way'], ['delivered', 'Delivered']] as const;
const PICKUP_STEPS = [['placed', 'Order sent to the restaurant'], ['accepted', 'Restaurant accepted · card charged'], ['preparing', 'Preparing your food'], ['ready', 'Ready for pickup'], ['completed', 'Picked up']] as const;
const RANK: Record<string, number> = { pending_payment: 0, placed: 1, accepted: 2, preparing: 3, ready: 3.5, picked_up: 4, delivered: 5, completed: 5 };

export default function TrackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { session, ready } = useSession();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [courierAt, setCourierAt] = useState<{ lat: number; lng: number } | null>(null);

  const load = useCallback(() => api<Order>(`/orders/${id}`).then(setOrder).catch((e) => setError(e instanceof ApiError ? e.message : 'Couldn’t load the order')), [id]);
  useEffect(() => {
    if (!session) return;
    void (async () => {
      // Covers the redirect back from a bank's 3-D Secure page.
      await api(`/orders/${id}/payment-confirmed`, { method: 'POST' }).catch(() => undefined);
      await load();
    })();
    const stop = liveStream(`/live/orders/${id}`, (type, data) => {
      if (type === 'courier.location') setCourierAt(data as { lat: number; lng: number });
      else void load();
    });
    const poll = setInterval(load, 30_000);
    return () => { stop(); clearInterval(poll); };
  }, [session, id, load]);

  if (!ready) return null;
  if (!session) return <div className="container" style={{ paddingTop: 48 }}><Link className="btn primary" href={`/sign-in?next=/orders/${id}`}>Sign in to track your order</Link></div>;
  if (error) return <div className="container" style={{ paddingTop: 32 }}><div className="error">{error}</div></div>;
  if (!order) return <div className="container" style={{ paddingTop: 32 }}><div className="skeleton" style={{ height: 240 }} /></div>;

  const steps = order.fulfilment === 'delivery' ? DELIVERY_STEPS : PICKUP_STEPS;
  const rank = RANK[order.status] ?? 0;
  const ended = order.status === 'declined' || order.status === 'cancelled';
  const canCancel = order.status === 'placed' || order.status === 'pending_payment';
  const courier = order.delivery?.courier;

  return (
    <div className="container" style={{ paddingTop: 24 }}>
      <div className="two-col">
        <div className="card pad stack">
          <span className="small muted">Order {order.code}</span>
          <h1 style={{ fontSize: 30 }}>{order.statusText}</h1>
          {ended ? <div className="note">{order.status === 'declined' ? 'The restaurant couldn’t take this order. Your card was not charged — the hold is released.' : 'This order was cancelled. Any hold on your card is released.'}</div> : (
            <div className="steps">
              {steps.map(([s, label]) => {
                const r = RANK[s];
                return <div key={s} className={`step ${rank >= r ? 'done' : ''} ${rank < r && rank >= r - 1 ? 'now' : ''}`}><span className="dot" /><span>{label}</span></div>;
              })}
            </div>
          )}
          {courier && <div className="note">Your courier <b>{courier.firstName}</b> {order.status === 'picked_up' ? 'is on the way' : 'is heading to the restaurant'}.{courierAt && <> <a className="link" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${courierAt.lat}&mlon=${courierAt.lng}#map=16/${courierAt.lat}/${courierAt.lng}`}>See on map</a></>}</div>}
          {canCancel && <button className="btn" onClick={async () => { try { setOrder(await api<Order>(`/orders/${id}/cancel`, { method: 'POST' })); } catch (e) { setError(e instanceof ApiError ? e.message : 'Could not cancel'); } }}>Cancel order</button>}
          <Link href="/help" className="link small">Problem with this order?</Link>
        </div>
        <aside className="card pad stack">
          <h3>Receipt</h3>
          <div className="small">{order.items.map((i) => <div key={i.itemId + i.name} className="row between"><span>{i.quantity}× {i.name}{i.options.length ? <span className="muted"> · {i.options.map((o) => o.name).join(', ')}</span> : null}</span></div>)}</div>
          <Receipt receipt={order.receipt} />
        </aside>
      </div>
    </div>
  );
}
