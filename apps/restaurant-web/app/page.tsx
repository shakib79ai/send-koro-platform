'use client';
/**
 * Live orders. New orders ring until someone accepts (or the 5-minute auto-decline releases the
 * customer's card hold). Accepting charges the card; declining releases it.
 */
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, liveStream } from '@/lib/api';
import { usePortal } from '@/lib/portal';
import { usd } from '@/lib/money';
import type { LiveOrder, Summary } from '@/lib/types';
import { Switch } from '@/components/ui';
import { useOrderAlert } from '@/lib/orderAlert';

const COURIER_TEXT: Record<string, string> = {
  requested: 'Finding a courier', offered: 'Finding a courier', assigned: 'Courier on the way', at_pickup: 'Courier is here',
  picked_up: 'Picked up', at_dropoff: 'At the customer', delivered: 'Delivered', cancelled: 'Courier cancelled — support notified', failed: 'Delivery problem — support notified',
};
const DECLINE_REASONS = ['Too busy right now', 'Item sold out', 'Closing soon', 'Kitchen problem'];

function nyMidnight() {
  const now = new Date();
  const ny = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  return new Date(now.getTime() - (ny.getHours() * 3600 + ny.getMinutes() * 60 + ny.getSeconds()) * 1000);
}

export default function LiveOrders() {
  const { restaurant, reload } = usePortal();
  const [orders, setOrders] = useState<LiveOrder[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState('');
  const [declining, setDeclining] = useState<LiveOrder | null>(null);
  const [locationId, setLocationId] = useState<string>('');

  const load = useCallback(async () => {
    if (!restaurant) return;
    try {
      const [live, sum] = await Promise.all([
        api<LiveOrder[]>(`/restaurant-orders/${restaurant.id}/live${locationId ? `?locationId=${locationId}` : ''}`),
        api<Summary>(`/restaurant-orders/${restaurant.id}/summary?from=${nyMidnight().toISOString()}&to=${new Date(Date.now() + 60_000).toISOString()}`),
      ]);
      setOrders(live); setSummary(sum); setError('');
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Connection problem — retrying'); }
  }, [restaurant, locationId]);

  useEffect(() => {
    if (!restaurant) return;
    void load();
    const stop = liveStream(`/live/restaurants/${restaurant.id}`, () => void load());
    const poll = setInterval(load, 20_000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { stop(); clearInterval(poll); clearInterval(tick); };
  }, [restaurant, load]);

  const fresh = orders.filter((o) => o.status === 'placed');
  // Rings every 10 s and flashes the tab title until every new order is answered.
  const { enabled, enable } = useOrderAlert(fresh.map((o) => o.id));

  if (!restaurant) return null;

  const act = async (fn: () => Promise<unknown>) => { try { await fn(); await load(); } catch (e) { setError(e instanceof ApiError ? e.message : 'Action failed'); } };
  const accept = (o: LiveOrder, prepMinutes: number) => act(() => api(`/restaurant-orders/orders/${o.id}/accept`, { body: { prepMinutes } }));
  const step = (o: LiveOrder, what: 'preparing' | 'ready' | 'collected') => act(() => api(`/restaurant-orders/orders/${o.id}/${what}`, { method: 'POST' }));
  const locName = (id: string) => restaurant.locations.find((l) => l.id === id)?.name ?? '';
  const multi = restaurant.locations.length > 1;

  const cols: { title: string; list: LiveOrder[] }[] = [
    { title: 'New', list: fresh },
    { title: 'Preparing', list: orders.filter((o) => o.status === 'accepted' || o.status === 'preparing') },
    { title: 'Ready', list: orders.filter((o) => o.status === 'ready') },
    { title: 'Out for delivery', list: orders.filter((o) => o.status === 'picked_up') },
  ];
  const countdown = (o: LiveOrder) => {
    if (!o.acceptBy) return '';
    const s = Math.max(0, Math.round((new Date(o.acceptBy).getTime() - now) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const age = (iso: string | null) => (iso ? `${Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))} min` : '');

  return (
    <div>
      <div className="page-head">
        <div><h1>Live orders</h1><p className="small muted" style={{ margin: '4px 0 0' }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/New_York' })} · New York time</p></div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          {multi && <select className="input" style={{ width: 'auto' }} value={locationId} onChange={(e) => setLocationId(e.target.value)}><option value="">All locations</option>{restaurant.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>}
          {!enabled && <button className="btn dark" onClick={enable}>🔔 Turn on order sound</button>}
        </div>
      </div>

      {restaurant.status !== 'live' && <div className="note" style={{ marginBottom: 14 }}>You’re not live yet — customers can’t see you. <a className="link" href="/setup">Finish setup</a></div>}

      <div className="card pad" style={{ marginBottom: 14, padding: 14 }}>
        {restaurant.locations.map((l) => {
          const busy = !!l.busyUntil && new Date(l.busyUntil).getTime() > now;
          return (
            <div key={l.id} className="row between" style={{ flexWrap: 'wrap', padding: '4px 0' }}>
              <div className="row"><Switch on={l.acceptingOrders} label={`Accepting orders at ${l.name}`} onChange={(v) => act(async () => { await api(`/restaurants/locations/${l.id}`, { method: 'PATCH', body: { acceptingOrders: v } }); await reload(); })} />
                <div><b>{l.name}</b> <span className="small muted">{l.acceptingOrders ? (busy ? `Busy until ${new Date(l.busyUntil!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · +15 min shown to customers` : 'Taking orders') : 'Paused — customers can’t order'}</span></div></div>
              <div className="row">{busy ? <button className="btn sm" onClick={() => act(async () => { await api(`/restaurants/locations/${l.id}`, { method: 'PATCH', body: { busyMinutes: null } }); await reload(); })}>End busy</button>
                : [15, 30].map((m) => <button key={m} className="btn sm" disabled={!l.acceptingOrders} onClick={() => act(async () => { await api(`/restaurants/locations/${l.id}`, { method: 'PATCH', body: { busyMinutes: m } }); await reload(); })}>Busy {m} min</button>)}</div>
            </div>
          );
        })}
      </div>

      <div className="kpis">
        <div className="kpi"><div className="k">Food sales today</div><div className="v">{usd(summary?.foodCents ?? 0)}</div><div className="tiny" style={{ color: 'var(--green)' }}>$0 commission</div></div>
        <div className="kpi"><div className="k">Orders</div><div className="v">{summary?.orders ?? 0}</div><div className="tiny muted">{summary?.inProgress ?? 0} in progress</div></div>
        <div className="kpi"><div className="k">Avg accept time</div><div className="v">{summary ? `${Math.floor(summary.avgAcceptSeconds / 60)}m ${summary.avgAcceptSeconds % 60}s` : '—'}</div><div className="tiny muted">Goal under 2 min</div></div>
        <div className="kpi"><div className="k">Delivery you paid</div><div className="v">{usd(summary?.deliveryPaidCents ?? 0)}</div><div className="tiny muted">Free-delivery help today</div></div>
      </div>

      {fresh.length > 0 && (
        <div className="banner pulse">🔔 {fresh.length} new order{fresh.length > 1 ? 's' : ''} — accept within {countdown(fresh[0])}<span className="spacer" /><span className="small hide-sm" style={{ fontWeight: 500 }}>Unanswered orders are declined at 5:00 and the customer’s card is released</span></div>
      )}
      {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}

      <div className="board">
        {cols.map((c) => (
          <div key={c.title} className="col">
            <h3>{c.title}<span className="badge gray">{c.list.length}</span></h3>
            {c.list.map((o) => (
              <div key={o.id} className={`ticket ${o.status === 'placed' ? 'new' : ''}`}>
                <div className="row between"><b>#{o.code.replace('SK-', '')}</b><span className={`badge ${o.fulfilment === 'delivery' ? 'orange' : 'green'}`}>{o.fulfilment === 'delivery' ? 'Delivery' : 'Pickup'}</span></div>
                {multi && <div className="tiny muted">{locName(o.locationId)}</div>}
                <div className="items">{o.items.map((it, i) => <div key={i}><b>{it.quantity}×</b><span>{it.name}{it.options.length > 0 && <span className="muted"> · {it.options.map((x) => x.name).join(', ')}</span>}{it.note && <span style={{ color: 'var(--red)' }}> · “{it.note}”</span>}</span></div>)}</div>
                {o.notes && <div className="tiny" style={{ color: 'var(--red)' }}>Note: {o.notes}</div>}
                <div className="row between tiny muted" style={{ margin: '6px 0 8px' }}><span>Food {usd(o.foodCents)}{o.taxCents ? ` · tax ${usd(o.taxCents)}` : ''}</span><span>{o.status === 'placed' ? countdown(o) : age(o.acceptedAt ?? o.placedAt)}</span></div>
                {o.courier && o.status !== 'placed' && <div className="tiny" style={{ marginBottom: 8 }}>🛵 {COURIER_TEXT[o.courier.status] ?? o.courier.status}</div>}
                {o.status === 'placed' && (
                  <div className="stack" style={{ gap: 6 }}>
                    <div className="row" style={{ gap: 6 }}>{[10, 15, 20, 30].map((m) => <button key={m} className="btn sm primary" style={{ flex: 1, padding: '7px 0' }} onClick={() => accept(o, m)}>{m}m</button>)}</div>
                    <div className="row"><span className="tiny muted spacer">Accept with prep time</span><button className="btn sm" onClick={() => setDeclining(o)}>Reject</button></div>
                  </div>
                )}
                {o.status === 'accepted' && <div className="row"><button className="btn sm" onClick={() => step(o, 'preparing')}>Start preparing</button><button className="btn sm dark spacer" onClick={() => step(o, 'ready')}>Mark ready</button></div>}
                {o.status === 'preparing' && <button className="btn sm dark block" onClick={() => step(o, 'ready')}>Mark ready</button>}
                {o.status === 'ready' && o.fulfilment === 'pickup' && <button className="btn sm dark block" onClick={() => step(o, 'collected')}>Customer picked up</button>}
              </div>
            ))}
            {!c.list.length && <p className="tiny muted center" style={{ padding: '18px 0' }}>Nothing here</p>}
          </div>
        ))}
      </div>

      {declining && (
        <div className="overlay" onClick={() => setDeclining(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="hd"><h2>Reject order #{declining.code.replace('SK-', '')}?</h2><p className="small muted">The customer is not charged — their card hold is released right away.</p></div>
            <div className="bd stack">{DECLINE_REASONS.map((r) => <button key={r} className="rule" onClick={async () => { const o = declining; setDeclining(null); await act(() => api(`/restaurant-orders/orders/${o.id}/decline`, { body: { reason: r } })); }}>{r}</button>)}</div>
            <div className="ft"><button className="btn block" onClick={() => setDeclining(null)}>Keep order</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
