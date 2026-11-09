'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useData } from '@/lib/admin';
import { Status, when } from '@/components/bits';
import { useAction } from '@/components/ui';

interface D { id: string; name: string; email: string; vehicle: string; status: string; online: boolean; payoutsReady: boolean; locationAt: string | null; createdAt: string }

export default function Drivers() {
  const [filter, setFilter] = useState('');
  const list = useData<D[]>(`/admin/drivers${filter ? `?status=${filter}` : ''}`, []);
  const { run, Status: S } = useAction();
  const set = (d: D, status: 'approved' | 'suspended') => run(async () => { await api(`/admin/drivers/${d.id}/status`, { body: { status } }); list.reload(); }, `${d.name}: ${status}`);
  return (
    <div>
      <div className="page-head"><div><h1>Drivers</h1><p className="small muted" style={{ margin: '4px 0 0' }}>Own drivers have their own Stripe accounts. No subscription and no fees — locked pay plus 100% of tips.</p></div>
        <div className="seg">{[['', 'All'], ['applied', 'Waiting'], ['approved', 'Approved'], ['suspended', 'Suspended']].map(([v, l]) => <button key={v} className={filter === v ? 'on' : ''} onClick={() => setFilter(v)}>{l}</button>)}</div></div>
      <S />
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="t"><thead><tr><th>Driver</th><th>Vehicle</th><th>Status</th><th>Online</th><th>Stripe payouts</th><th>Applied</th><th /></tr></thead>
          <tbody>{(list.data ?? []).map((d) => (
            <tr key={d.id}>
              <td><b>{d.name}</b><div className="tiny muted">{d.email}</div></td><td className="small">{d.vehicle}</td><td><Status s={d.status} /></td>
              <td className="small">{d.online ? `● online · seen ${when(d.locationAt)}` : 'offline'}</td>
              <td>{d.payoutsReady ? <Status s="active" /> : <Status s="pending" />}</td><td className="small">{when(d.createdAt)}</td>
              <td><div className="row" style={{ gap: 6 }}>{d.status !== 'approved' && <button className="btn sm primary" onClick={() => set(d, 'approved')}>Approve</button>}{d.status !== 'suspended' && <button className="btn sm" onClick={() => set(d, 'suspended')}>Suspend</button>}</div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
