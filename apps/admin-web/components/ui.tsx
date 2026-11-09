'use client';
import { useState } from 'react';
import { ApiError } from '@/lib/api';

/** Runs an async action with busy/error/success state; errors from the API are shown as-is. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const run = async (fn: () => Promise<unknown>, success = 'Saved') => {
    setBusy(true); setError(''); setOk('');
    try { await fn(); setOk(success); setTimeout(() => setOk(''), 2500); return true; }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Something went wrong'); return false; }
    finally { setBusy(false); }
  };
  const Status = () => <>{error && <div className="error">{error}</div>}{ok && <div className="success">{ok}</div>}</>;
  return { busy, error, ok, run, Status };
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)} />;
}

/** Dollar input that reads and writes integer cents. */
export function MoneyInput({ cents, onChange, id, placeholder }: { cents: number | null | undefined; onChange: (c: number | null) => void; id?: string; placeholder?: string }) {
  const [text, setText] = useState(cents == null ? '' : (cents / 100).toFixed(2));
  return (
    <div className="row" style={{ gap: 6 }}>
      <span className="muted">$</span>
      <input id={id} className="input" inputMode="decimal" placeholder={placeholder ?? '0.00'} value={text}
        onChange={(e) => { const t = e.target.value.replace(/[^\d.]/g, ''); setText(t); onChange(t === '' ? null : Math.round(parseFloat(t) * 100)); }} />
    </div>
  );
}

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const percentFromPpm = (ppm: number) => (ppm / 10_000).toFixed(3).replace(/\.?0+$/, '');
