'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError, saveSession, Session } from '@/lib/api';
import { BrandLogo } from '@/components/BrandLogo';

const toE164 = (p: string) => { const d = p.replace(/\D/g, ''); return d.length === 10 ? `+1${d}` : d.length === 11 && d.startsWith('1') ? `+${d}` : ''; };

export default function SignIn() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const e164 = toE164(phone);
  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(''); try { await fn(); } catch (e) { setError(e instanceof ApiError ? e.message : 'Something went wrong'); } finally { setBusy(false); } };

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 16, background: 'var(--ink)' }}>
      <div className="card pad stack" style={{ width: '100%', maxWidth: 420 }}>
        <div><BrandLogo height={34} /><div className="tiny bold" style={{ color: 'var(--orange)', letterSpacing: '.14em' }}>ADMIN</div></div>
        <h1 style={{ fontSize: 26 }}>{sent ? 'Enter the code' : 'Admin sign in'}</h1>
        {!sent ? (<>
          <p className="small muted" style={{ margin: 0 }}>Admins are added by another admin (or with the create-admin command on the server).</p>
          <div className="field"><label htmlFor="p">Mobile number</label><input id="p" className="input" type="tel" autoComplete="tel" placeholder="(917) 555-0100" value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e164 && run(async () => { await api('/auth/code', { body: { phone: e164, role: 'admin' }, auth: false }); setSent(true); })} /></div>
          <button className="btn primary block" disabled={!e164 || busy} onClick={() => run(async () => { await api('/auth/code', { body: { phone: e164, role: 'admin' }, auth: false }); setSent(true); })}>Text me a code</button>
        </>) : (<>
          <p className="small muted" style={{ margin: 0 }}>Sent to {e164}. <button className="link" onClick={() => setSent(false)}>Change</button></p>
          <input className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center' }} autoFocus />
          <button className="btn primary block" disabled={code.length !== 6 || busy} onClick={() => run(async () => { const s = await api<Session>('/auth/verify', { body: { phone: e164, role: 'admin', code }, auth: false }); saveSession(s); router.replace('/'); })}>Sign in</button>
        </>)}
        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
}
