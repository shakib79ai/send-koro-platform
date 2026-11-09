'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAction } from '@/components/ui';

const toE164 = (p: string) => { const d = p.replace(/\D/g, ''); return d.length === 10 ? `+1${d}` : d.length === 11 && d.startsWith('1') ? `+${d}` : ''; };

export default function Admins() {
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const { busy, run, Status } = useAction();
  return (
    <div style={{ maxWidth: 640 }}>
      <div className="page-head"><h1>Admins</h1></div>
      <div className="card pad stack" style={{ marginBottom: 16 }}>
        <h3>Add an admin</h3>
        <p className="small muted" style={{ margin: 0 }}>They sign in to this console with their mobile number. Admins can see courier companies, refund orders and change restaurant and driver status.</p>
        <div className="form-grid"><div className="field"><label>Mobile</label><input className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></div><div className="field"><label>Name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div></div>
        <button className="btn primary" style={{ alignSelf: 'flex-start' }} disabled={busy || !toE164(phone) || name.length < 2} onClick={() => run(async () => { await api('/admin/admins', { body: { phone: toE164(phone), name } }); setPhone(''); setName(''); }, 'Admin added')}>Add admin</button>
      </div>
      <div className="card pad stack">
        <h3>Disable or re-enable any account</h3>
        <p className="small muted" style={{ margin: 0 }}>Paste a user ID (shown in order details and logs). Disabled users can’t sign in.</p>
        <input className="input" value={userId} onChange={(e) => setUserId(e.target.value.trim())} placeholder="User ID" />
        <div className="row"><button className="btn" disabled={busy || userId.length < 30} onClick={() => run(() => api(`/admin/users/${userId}/disabled`, { body: { disabled: true } }), 'Disabled')}>Disable</button><button className="btn" disabled={busy || userId.length < 30} onClick={() => run(() => api(`/admin/users/${userId}/disabled`, { body: { disabled: false } }), 'Enabled')}>Enable</button></div>
      </div>
      <Status />
    </div>
  );
}
