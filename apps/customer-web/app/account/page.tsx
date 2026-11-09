'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/lib/session';
import { AddressForm, AddressDraft } from '@/components/AddressForm';
import { labelOf } from '@/components/Header';

export default function AccountPage() {
  const { session, ready, addresses, reloadAddresses, signOut } = useSession();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  useEffect(() => { if (session) { setName(session.user.name ?? ''); setEmail(session.user.email ?? ''); } }, [session]);

  if (!ready) return null;
  if (!session) return <div className="container" style={{ paddingTop: 48 }}><div className="card pad center stack" style={{ maxWidth: 420, margin: '0 auto' }}><h2>Account</h2><Link className="btn primary" href="/sign-in?next=/account">Sign in / Sign up</Link></div></div>;

  const saveProfile = async () => {
    setError(''); setSaved('');
    try { await api('/auth/me', { method: 'PATCH', body: { name, email: email || undefined } }); setSaved('Saved'); } catch (e) { setError(e instanceof ApiError ? e.message : 'Could not save'); }
  };
  const addAddress = async (a: AddressDraft) => { await api('/me/addresses', { body: a }); await reloadAddresses(); setAdding(false); };
  const makeDefault = async (id: string) => { await api(`/me/addresses/${id}`, { method: 'PATCH', body: { isDefault: true } }); await reloadAddresses(); };
  const remove = async (id: string) => { await api(`/me/addresses/${id}`, { method: 'DELETE' }); await reloadAddresses(); };

  return (
    <div className="container" style={{ paddingTop: 24, maxWidth: 760 }}>
      <h1 style={{ fontSize: 30, marginBottom: 16 }}>Account</h1>
      <div className="card pad stack">
        <h3>Profile</h3>
        <div className="field"><label>Mobile number</label><input className="input" value={session.user.phone} disabled /></div>
        <div className="field"><label htmlFor="n">Name</label><input id="n" className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label htmlFor="e">Email for receipts</label><input id="e" className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        {error && <div className="error">{error}</div>}{saved && <div className="success">{saved}</div>}
        <button className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={saveProfile}>Save</button>
      </div>
      <div className="card pad stack" style={{ marginTop: 16 }}>
        <div className="row between"><h3>Addresses</h3>{!adding && <button className="btn sm" onClick={() => setAdding(true)}>+ Add</button>}</div>
        {addresses.map((a) => (
          <div key={a.id} className="addr-opt">
            <div className="spacer"><div className="bold">{labelOf(a)}{a.isDefault && <span className="badge gray" style={{ marginLeft: 8 }}>Default</span>}</div><div className="small muted">{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.postalCode}</div>{a.dropoffInstructions && <div className="tiny muted">“{a.dropoffInstructions}”</div>}</div>
            <div className="row">{!a.isDefault && <button className="btn sm" onClick={() => makeDefault(a.id)}>Make default</button>}<button className="btn sm" onClick={() => remove(a.id)}>Remove</button></div>
          </div>
        ))}
        {adding && <AddressForm onSave={addAddress} initialLabel={addresses.some((a) => a.label === 'home') ? 'office' : 'home'} />}
      </div>
      <button className="btn" style={{ marginTop: 16 }} onClick={async () => { await signOut(); router.push('/'); }}>Sign out</button>
    </div>
  );
}
