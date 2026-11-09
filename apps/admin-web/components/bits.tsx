import { usd } from '@/lib/money';

export const PROVIDER: Record<string, string> = { uber_direct: 'Uber Direct', doordash_drive: 'DoorDash Drive', own_driver: 'Send Koro driver', pickup: 'Pickup' };
const TONE: Record<string, string> = {
  placed: 'orange', accepted: 'orange', preparing: 'orange', ready: 'orange', picked_up: 'orange', delivered: 'green', completed: 'green', declined: 'gray', cancelled: 'gray', pending_payment: 'gray',
  paid: 'green', pending: 'orange', owed: 'red', processing: 'orange', failed: 'red', on_hold: 'red', reversed: 'gray', live: 'green', paused: 'orange', suspended: 'red', onboarding: 'gray', approved: 'green', applied: 'orange',
  mock: 'gray', sandbox: 'orange', active: 'green', trialing: 'green', past_due: 'red',
};
export function Status({ s }: { s: string }) { return <span className={`badge ${TONE[s] ?? 'gray'}`}>{s.replace(/_/g, ' ')}</span>; }
export function Money({ c }: { c: number | null | undefined }) { return <>{c == null ? '—' : usd(c)}</>; }
export function Kpi({ k, v, sub }: { k: string; v: React.ReactNode; sub?: React.ReactNode }) { return <div className="kpi"><div className="k">{k}</div><div className="v">{v}</div>{sub && <div className="tiny muted">{sub}</div>}</div>; }
export const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
export const ppmPct = (ppm: number) => `${(ppm / 10_000).toFixed(3).replace(/\.?0+$/, '')}%`;
