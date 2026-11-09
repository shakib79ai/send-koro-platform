'use client';
/** One page for sign in and sign up (as designed): phone → 6-digit code → name + first address for new customers. */
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError, saveSession, Session } from '@/lib/api';
import { useSession } from '@/lib/session';
import { AddressForm, AddressDraft } from '@/components/AddressForm';

function toE164(input: string) {
  const d = input.replace(/\D/g, '');
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith('1')) return `+${d}`;
  return input.startsWith('+') ? `+${d}` : '';
}

function SignInInner() {
  const router = useRouter();
  const next = useSearchParams().get('next') ?? '/';
  const { reloadAddresses, selectAddress } = useSession();
  const [step, setStep] = useState<'phone' | 'code' | 'profile' | 'address'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const e164 = toE164(phone);
  const run = async (fn: () => Promise<void>) => { setBusy(true); setError(''); try { await fn(); } catch (e) { setError(e instanceof ApiError ? e.message : 'Something went wrong'); } finally { setBusy(false); } };

  const sendCode = () => run(async () => { await api('/auth/code', { body: { phone: e164, role: 'customer' }, auth: false }); setStep('code'); });
  const verify = () => run(async () => {
    const s = await api<Session & { isNew: boolean }>('/auth/verify', { body: { phone: e164, role: 'customer', code }, auth: false });
    saveSession(s);
    if (s.isNew || !s.user.name) setStep('profile'); else router.push(next);
  });
  const saveProfile = () => run(async () => { await api('/auth/me', { method: 'PATCH', body: { name, email: email || undefined } }); setStep('address'); });
  const saveAddress = async (a: AddressDraft) => {
    const created = await api<{ id: string }>('/me/addresses', { body: { ...a, isDefault: true } });
    await reloadAddresses(); selectAddress(created.id); router.push(next);
  };

  return (
    <div className="container" style={{ paddingTop: 40 }}>
      <div className="card pad stack" style={{ maxWidth: 440, margin: '0 auto', gap: 16 }}>
        {step === 'phone' && (<>
          <div><h1 style={{ fontSize: 28 }}>Sign in or create an account</h1><p className="muted small">One step for both. We’ll text you a code.</p></div>
          <div className="field"><label htmlFor="ph">Mobile number</label><input id="ph" className="input" type="tel" autoComplete="tel" placeholder="(917) 555-0123" value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && e164 && sendCode()} /></div>
          <button className="btn primary block" disabled={!e164 || busy} onClick={sendCode}>Text me a code</button>
          <p className="tiny muted">By continuing you agree to the Terms and Privacy Policy. Message and data rates may apply.</p>
        </>)}
        {step === 'code' && (<>
          <div><h1 style={{ fontSize: 28 }}>Enter the code</h1><p className="muted small">Sent to {e164}. <button className="link" onClick={() => setStep('phone')}>Change</button></p></div>
          <input className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && verify()} style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center' }} autoFocus />
          <button className="btn primary block" disabled={code.length !== 6 || busy} onClick={verify}>Continue</button>
          <button className="link small" disabled={busy} onClick={sendCode}>Send a new code</button>
        </>)}
        {step === 'profile' && (<>
          <div><h1 style={{ fontSize: 28 }}>Welcome to Send Koro</h1><p className="muted small">Tell us your name so restaurants and couriers know who the order is for.</p></div>
          <div className="field"><label htmlFor="nm">Your name</label><input id="nm" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field"><label htmlFor="em">Email for receipts (optional)</label><input id="em" className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <button className="btn primary block" disabled={name.trim().length < 2 || busy} onClick={saveProfile}>Continue</button>
        </>)}
        {step === 'address' && (<>
          <div><h1 style={{ fontSize: 28 }}>Where should we deliver?</h1><p className="muted small">Add Home now — you can add Office and other places any time.</p></div>
          <AddressForm onSave={saveAddress} saveLabel="Save and start ordering" />
          <button className="link small" onClick={() => router.push(next)}>Skip for now</button>
        </>)}
        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
}

export default function SignInPage() { return <Suspense><SignInInner /></Suspense>; }
