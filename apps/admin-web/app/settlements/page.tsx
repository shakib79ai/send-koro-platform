'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useData } from '@/lib/admin';
import { Kpi, Money, PROVIDER, Status, when } from '@/components/bits';
import { MoneyInput, useAction } from '@/components/ui';

interface Transfer { id: string; orderId: string; driverName: string; payCents: number; tipCents: number; amountCents: number; status: string; stripeTransferId: string | null; lastError: string | null; createdAt: string }
interface TopUp { id: string; driverName: string; weekStart: string; tripSeconds: number; minimumCents: number; paidCents: number; amountCents: number; status: string; lastError: string | null }
interface Obligation { orderId: string; provider: string; providerDeliveryId: string | null; quotedCents: number; actualCents: number | null; tipCents: number; tipSubmittedAt: string | null; invoiceRef: string | null; status: string; createdAt: string; varianceCents: number | null }

export default function Settlements() {
  const [tab, setTab] = useState<'drivers' | 'couriers'>('drivers');
  const ds = useData<{ transfers: Transfer[]; topUps: TopUp[] }>('/admin/money/driver-settlements');
  const so = useData<Obligation[]>('/admin/money/supplier-obligations');
  const { busy, run, Status: S } = useAction();
  const [rec, setRec] = useState<{ orderId: string; billedCents: number | null; tipCents: number | null; invoiceRef: string } | null>(null);
  const t = ds.data?.transfers ?? [];
  const owed = t.filter((x) => ['owed', 'failed'].includes(x.status));
  const sum = (l: { amountCents: number }[]) => l.reduce((a, x) => a + x.amountCents, 0);
  const obl = so.data ?? [];

  return (
    <div>
      <div className="page-head"><div><h1>Driver & courier settlements</h1><p className="small muted" style={{ margin: '4px 0 0' }}>Own drivers: locked pay + 100% tip by Stripe transfer, once per order. Couriers: paid by invoice, full tip through their tip field. No fees are taken from driver pay or tips.</p></div>
        <div className="seg"><button className={tab === 'drivers' ? 'on' : ''} onClick={() => setTab('drivers')}>Own drivers</button><button className={tab === 'couriers' ? 'on' : ''} onClick={() => setTab('couriers')}>Uber Direct & DoorDash</button></div></div>
      <S />
      {tab === 'drivers' ? (<>
        <div className="kpis">
          <Kpi k="Paid to drivers" v={<Money c={sum(t.filter((x) => x.status === 'paid'))} />} sub={`${t.filter((x) => x.status === 'paid').length} transfers`} />
          <Kpi k="Tips included" v={<Money c={t.reduce((a, x) => a + x.tipCents, 0)} />} sub="100% to drivers" />
          <Kpi k="Owed / failed" v={<Money c={sum(owed)} />} sub={`${owed.length} waiting`} />
          <Kpi k="NYC minimum top-ups" v={<Money c={sum(ds.data?.topUps ?? [])} />} sub={`${ds.data?.topUps.filter((x) => x.amountCents > 0).length ?? 0} weeks topped up`} />
        </div>
        {owed.length > 0 && <div className="note" style={{ marginBottom: 12 }}>{owed.length} transfer(s) waiting — usually the platform balance wasn’t available yet or the driver hasn’t finished Stripe onboarding. The retry job runs on its own. <button className="link" disabled={busy} onClick={() => run(async () => { await api('/admin/money/driver-settlements/retry', { method: 'POST' }); ds.reload(); }, 'Retried')}>Retry now</button></div>}
        <div className="card" style={{ overflowX: 'auto', marginBottom: 16 }}>
          <table className="t"><thead><tr><th>When</th><th>Driver</th><th>Locked pay</th><th>Tip</th><th>Transfer</th><th>Status</th><th>Stripe</th></tr></thead>
            <tbody>{t.map((x) => <tr key={x.id}><td className="small">{when(x.createdAt)}</td><td>{x.driverName}</td><td><Money c={x.payCents} /></td><td><Money c={x.tipCents} /></td><td><b><Money c={x.amountCents} /></b></td><td><Status s={x.status} />{x.lastError && <div className="tiny" style={{ color: 'var(--red)' }}>{x.lastError}</div>}</td><td className="tiny"><code>{x.stripeTransferId ?? '—'}</code></td></tr>)}
              {!t.length && <tr><td colSpan={7} className="muted">No driver transfers yet.</td></tr>}</tbody>
          </table>
        </div>
        <div className="card" style={{ overflowX: 'auto' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}><h3>NYC minimum pay ($22.13 per trip hour)</h3></div>
          <table className="t"><thead><tr><th>Week of</th><th>Driver</th><th>Trip time</th><th>Minimum</th><th>Locked pay</th><th>Top-up</th><th>Status</th></tr></thead>
            <tbody>{(ds.data?.topUps ?? []).map((x) => <tr key={x.id}><td>{x.weekStart}</td><td>{x.driverName}</td><td className="small">{(x.tripSeconds / 3600).toFixed(1)} h</td><td><Money c={x.minimumCents} /></td><td><Money c={x.paidCents} /></td><td><b><Money c={x.amountCents} /></b></td><td><Status s={x.status} /></td></tr>)}
              {!ds.data?.topUps.length && <tr><td colSpan={7} className="muted">Calculated every Monday for the previous week.</td></tr>}</tbody>
          </table>
        </div>
      </>) : (<>
        <div className="kpis">
          {(['uber_direct', 'doordash_drive'] as const).map((p) => { const l = obl.filter((o) => o.provider === p); return <Kpi key={p} k={PROVIDER[p]} v={<Money c={l.reduce((a, o) => a + o.quotedCents + o.tipCents, 0)} />} sub={`${l.length} deliveries · quote + tip`} />; })}
          <Kpi k="Awaiting invoice" v={obl.filter((o) => o.status === 'pending').length} sub="not reconciled yet" />
          <Kpi k="Variance to review" v={obl.filter((o) => o.status === 'owed').length} sub="billed ≠ quoted" />
        </div>
        <div className="card" style={{ overflowX: 'auto' }}>
          <table className="t"><thead><tr><th>When</th><th>Provider</th><th>Delivery ID</th><th>Quoted</th><th>Tip (passed 100%)</th><th>Billed</th><th>Variance</th><th>Status</th><th /></tr></thead>
            <tbody>{obl.map((o) => (
              <tr key={o.orderId}>
                <td className="small">{when(o.createdAt)}</td><td>{PROVIDER[o.provider]}</td><td className="tiny"><code>{o.providerDeliveryId}</code></td><td><Money c={o.quotedCents} /></td>
                <td><Money c={o.tipCents} />{o.tipCents > 0 && <div className="tiny muted">{o.tipSubmittedAt ? '✓ in tip field' : 'not confirmed'}</div>}</td>
                <td><Money c={o.actualCents} />{o.invoiceRef && <div className="tiny muted">{o.invoiceRef}</div>}</td>
                <td style={{ color: o.varianceCents ? 'var(--red)' : undefined }}>{o.varianceCents == null ? '—' : <Money c={o.varianceCents} />}</td>
                <td><Status s={o.status} /></td>
                <td>{o.status !== 'paid' && <button className="btn sm" onClick={() => setRec({ orderId: o.orderId, billedCents: o.quotedCents, tipCents: o.tipCents, invoiceRef: '' })}>Reconcile</button>}</td>
              </tr>
            ))}{!obl.length && <tr><td colSpan={9} className="muted">No third-party deliveries yet.</td></tr>}</tbody>
          </table>
        </div>
        {rec && (
          <div className="overlay" onClick={() => setRec(null)}><div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="hd"><h2>Reconcile invoice line</h2></div>
            <div className="bd stack">
              <div className="field"><label>Billed for delivery</label><MoneyInput cents={rec.billedCents} onChange={(c) => setRec({ ...rec, billedCents: c })} /></div>
              <div className="field"><label>Tip on the invoice</label><MoneyInput cents={rec.tipCents} onChange={(c) => setRec({ ...rec, tipCents: c })} /></div>
              <div className="field"><label>Invoice reference</label><input className="input" value={rec.invoiceRef} onChange={(e) => setRec({ ...rec, invoiceRef: e.target.value })} /></div>
            </div>
            <div className="ft row"><button className="btn" onClick={() => setRec(null)}>Cancel</button><span className="spacer" /><button className="btn primary" disabled={busy || !rec.invoiceRef} onClick={() => run(async () => { await api(`/admin/money/supplier-obligations/${rec.orderId}/reconcile`, { body: { billedCents: rec.billedCents ?? 0, tipCents: rec.tipCents ?? 0, invoiceRef: rec.invoiceRef } }); setRec(null); so.reload(); }, 'Reconciled')}>Save</button></div>
          </div></div>
        )}
      </>)}
    </div>
  );
}
