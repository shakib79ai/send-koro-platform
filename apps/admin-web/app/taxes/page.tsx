'use client';
import { useData } from '@/lib/admin';
import { Status, ppmPct } from '@/components/bits';

interface Tax { policy: { launchStates: string[]; blockedStates: Record<string, string>; platformCollectsTax: boolean }; restaurants: { id: string; name: string; status: string; taxResponsibilityAcceptedAt: string | null; locations: { id: string; name: string; state: string; postalCode: string; taxRatePpm: number }[] }[] }

export default function Taxes() {
  const { data: d, error } = useData<Tax>('/admin/tax-compliance');
  if (!d) return <p className="muted">{error || 'Loading…'}</p>;
  const missing = d.restaurants.filter((r) => !r.taxResponsibilityAcceptedAt);
  const zero = d.restaurants.flatMap((r) => r.locations.filter((l) => l.taxRatePpm === 0).map((l) => ({ r, l })));
  return (
    <div>
      <div className="page-head"><div><h1>Taxes & compliance</h1><p className="small muted" style={{ margin: '4px 0 0' }}>Restaurants set, charge, report and pay their own sales tax. Send Koro never collects, files or pays it.</p></div></div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', marginBottom: 16 }}>
        <div className="card pad"><h3>Platform collects tax?</h3><p style={{ margin: '6px 0 0' }}><Status s={d.policy.platformCollectsTax ? 'failed' : 'active'} /> {d.policy.platformCollectsTax ? 'Yes' : 'No — by design'}</p></div>
        <div className="card pad"><h3>Launch states</h3><p className="small" style={{ margin: '6px 0 0' }}>{d.policy.launchStates.join(', ')}</p><p className="tiny muted">Add a state only after legal review of its marketplace-facilitator law.</p></div>
        <div className="card pad"><h3>Blocked</h3>{Object.entries(d.policy.blockedStates).map(([s, why]) => <p key={s} className="small" style={{ margin: '6px 0 0' }}><b>{s}</b> — {why}</p>)}</div>
      </div>
      {(missing.length > 0 || zero.length > 0) && <div className="note" style={{ marginBottom: 16 }}>{missing.length > 0 && <div>⚠ {missing.length} restaurant(s) haven’t accepted tax responsibility — they can’t take orders: {missing.map((r) => r.name).join(', ')}.</div>}{zero.length > 0 && <div>⚠ {zero.length} location(s) have a 0% tax rate: {zero.map(({ r, l }) => `${r.name} (${l.name})`).join(', ')}.</div>}</div>}
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="t"><thead><tr><th>Restaurant</th><th>Status</th><th>Tax responsibility</th><th>Locations & rates</th></tr></thead>
          <tbody>{d.restaurants.map((r) => <tr key={r.id}><td><b>{r.name}</b></td><td><Status s={r.status} /></td><td className="small">{r.taxResponsibilityAcceptedAt ? `✓ accepted ${new Date(r.taxResponsibilityAcceptedAt).toLocaleDateString()}` : <span style={{ color: 'var(--red)' }}>Not accepted</span>}</td><td className="small">{r.locations.map((l) => <div key={l.id}>{l.name} · {l.state} {l.postalCode} · <b>{ppmPct(l.taxRatePpm)}</b></div>)}</td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}
