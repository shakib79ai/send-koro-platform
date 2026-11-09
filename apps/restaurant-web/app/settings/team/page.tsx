'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { usePortal, canManage, isOwner } from '@/lib/portal';
import { useAction } from '@/components/ui';

interface Member { userId: string; name: string | null; phone: string; role: 'owner' | 'manager' | 'staff' }
const ROLE_HELP = { owner: 'Everything, including payouts, tax and delivery fee', manager: 'Menu, hours, team (staff and managers)', staff: 'Live orders and sold-out items' };
const toE164 = (p: string) => { const d = p.replace(/\D/g, ''); return d.length === 10 ? `+1${d}` : d.length === 11 && d.startsWith('1') ? `+${d}` : ''; };

export default function Team() {
  const { restaurant, role, session } = usePortal();
  const [team, setTeam] = useState<Member[]>([]);
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [newRole, setNewRole] = useState<Member['role']>('staff');
  const { busy, run, Status } = useAction();
  const load = useCallback(async () => { if (restaurant) setTeam(await api<Member[]>(`/restaurants/${restaurant.id}/team`)); }, [restaurant]);
  useEffect(() => { void load(); }, [load]);
  if (!restaurant) return null;

  return (
    <div style={{ maxWidth: 820 }}>
      <div className="page-head"><div><h1>Team & roles</h1><p className="small muted" style={{ margin: '4px 0 0' }}>Teammates sign in with their own mobile number.</p></div></div>
      <div className="card" style={{ marginBottom: 16 }}>
        <table className="t"><thead><tr><th>Name</th><th>Mobile</th><th>Role</th><th /></tr></thead>
          <tbody>{team.map((m) => <tr key={m.userId}><td>{m.name ?? '—'}{m.userId === session?.user.id && <span className="tiny muted"> (you)</span>}</td><td className="small">{m.phone}</td><td><span className="badge gray">{m.role}</span></td>
            <td>{isOwner(role) && m.userId !== session?.user.id && <button className="btn sm" onClick={() => run(async () => { await api(`/restaurants/${restaurant.id}/team/${m.userId}`, { method: 'DELETE' }); await load(); }, 'Removed')}>Remove</button>}</td></tr>)}</tbody>
        </table>
      </div>
      {canManage(role) && (
        <div className="card pad stack">
          <h3>Add a teammate</h3>
          <div className="form-grid">
            <div className="field"><label>Mobile number</label><input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(917) 555-0111" /></div>
            <div className="field"><label>Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
          </div>
          <div className="stack" style={{ gap: 6 }}>{(['staff', 'manager', 'owner'] as const).filter((r) => isOwner(role) || r !== 'owner').map((r) => <label key={r} className={`rule ${newRole === r ? 'on' : ''}`}><input type="radio" checked={newRole === r} onChange={() => setNewRole(r)} style={{ marginTop: 3 }} /><span><b style={{ textTransform: 'capitalize' }}>{r}</b><span className="small muted" style={{ display: 'block' }}>{ROLE_HELP[r]}</span></span></label>)}</div>
          <Status />
          <button className="btn primary" style={{ alignSelf: 'flex-start' }} disabled={busy || !toE164(phone)} onClick={() => run(async () => { await api(`/restaurants/${restaurant.id}/team`, { body: { phone: toE164(phone), name: name || undefined, role: newRole } }); setPhone(''); setName(''); await load(); }, 'Added — they can sign in now')}>Add teammate</button>
        </div>
      )}
    </div>
  );
}
