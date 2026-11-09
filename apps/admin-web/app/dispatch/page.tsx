'use client';
import { useData } from '@/lib/admin';
import { PROVIDER, Status } from '@/components/bits';

interface Integrations {
  paymentsServiceUp: boolean; dispatchOrder: string[]; sms: string; push: string;
  providers: { key: string; name: string; role: string; mode: string; drivers?: { online: number; approved: number; pending: number } }[];
  last7Days: { provider: string; status: string; n: number }[];
}

export default function Dispatch() {
  const { data: d, error } = useData<Integrations>('/admin/integrations');
  if (!d) return <p className="muted">{error || 'Loading…'}</p>;
  const by = (p: string) => d.last7Days.filter((r) => r.provider === p);
  return (
    <div>
      <div className="page-head"><div><h1>Dispatch & integrations</h1><p className="small muted" style={{ margin: '4px 0 0' }}>Delivery price = the Uber Direct quote, also for own drivers. Customers see “Delivery fee” only.</p></div></div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginBottom: 16 }}>
        {d.providers.map((p) => (
          <div key={p.key} className="card pad stack" style={{ gap: 8 }}>
            <div className="row between"><h3>{p.name}</h3><Status s={p.mode} /></div>
            <div className="small muted">{p.role}{p.key !== 'own_driver' && p.mode === 'mock' ? ' · no credentials yet — simulated' : ''}</div>
            {p.drivers && <div className="small">{p.drivers.online} online · {p.drivers.approved} approved · {p.drivers.pending} waiting for approval</div>}
            <div className="tiny muted">Last 7 days: {by(p.key).length ? by(p.key).map((r) => `${r.n} ${r.status.replace('_', ' ')}`).join(' · ') : 'no deliveries'}</div>
          </div>
        ))}
      </div>
      <div className="card pad stack">
        <h3>How orders are dispatched</h3>
        <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>
          {d.dispatchOrder.map((p) => <li key={p}><b>{PROVIDER[p] ?? p}</b>{p === 'own_driver' ? ' — offered to the nearest approved, online driver (45 s per offer, 2 orders on one route when they fit). If nobody accepts within 4 minutes, it goes to the next provider.' : ' — re-quoted with the order ID, then booked with 100% of the tip in its tip field.'}</li>)}
        </ol>
        <div className="row small" style={{ gap: 16, flexWrap: 'wrap' }}>
          <span>Payments service: {d.paymentsServiceUp ? <Status s="active" /> : <Status s="failed" />}</span>
          <span>SMS: <Status s={d.sms === 'console' ? 'mock' : 'active'} /> {d.sms}</span>
          <span>Push: <Status s={d.push === 'console' ? 'mock' : 'active'} /> {d.push}</span>
        </div>
        <p className="tiny muted" style={{ margin: 0 }}>Modes and the order are set on the server (api.env: UBER_DIRECT_MODE, DOORDASH_DRIVE_MODE, DISPATCH_ORDER).</p>
      </div>
    </div>
  );
}
