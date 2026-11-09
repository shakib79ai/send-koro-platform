'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useData } from '@/lib/admin';
import { Status, when } from '@/components/bits';
import { useAction } from '@/components/ui';

interface R { id: string; name: string; contactEmail: string; cuisine: string | null; status: string; taxResponsibilityAcceptedAt: string | null; deliveryRuleVersion: number | null; payoutsReady: boolean; createdAt: string }

export default function Restaurants() {
  const [q, setQ] = useState('');
  const list = useData<R[]>(`/admin/restaurants${q ? `?q=${encodeURIComponent(q)}` : ''}`, []);
  const { run, Status: S } = useAction();
  const set = (r: R, status: string) => run(async () => { await api(`/admin/restaurants/${r.id}/status`, { body: { status } }); list.reload(); }, `${r.name}: ${status}`);
  return (
    <div>
      <div className="page-head"><h1>Restaurants</h1><input className="input" placeholder="Search by name" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 260 }} /></div>
      <S />
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="t"><thead><tr><th>Restaurant</th><th>Status</th><th>Tax accepted</th><th>Delivery rule</th><th>Stripe payouts</th><th>Joined</th><th /></tr></thead>
          <tbody>{(list.data ?? []).map((r) => (
            <tr key={r.id}>
              <td><b>{r.name}</b><div className="tiny muted">{r.cuisine} · {r.contactEmail}</div></td>
              <td><Status s={r.status} /></td>
              <td className="small">{r.taxResponsibilityAcceptedAt ? `✓ ${new Date(r.taxResponsibilityAcceptedAt).toLocaleDateString()}` : <span style={{ color: 'var(--red)' }}>Not yet</span>}</td>
              <td className="small">{r.deliveryRuleVersion ? `v${r.deliveryRuleVersion}` : '—'}</td>
              <td>{r.payoutsReady ? <Status s="active" /> : <Status s="pending" />}</td>
              <td className="small">{when(r.createdAt)}</td>
              <td><div className="row" style={{ gap: 6 }}>
                <Link className="btn sm" href={`/payouts/${r.id}`}>Money</Link>
                {r.status === 'live' ? <button className="btn sm" onClick={() => set(r, 'paused')}>Pause</button> : r.status !== 'onboarding' && <button className="btn sm" onClick={() => set(r, 'live')}>Make live</button>}
                {r.status !== 'suspended' && <button className="btn sm" onClick={() => confirm(`Suspend ${r.name}? Customers won’t see it.`) && set(r, 'suspended')}>Suspend</button>}
              </div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
