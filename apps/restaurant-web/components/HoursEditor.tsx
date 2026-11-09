'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { usePortal } from '@/lib/portal';
import type { Location } from '@/lib/types';
import { DAYS, Switch, useAction } from './ui';

interface DayRow { open: boolean; opensAt: string; closesAt: string }

export function HoursEditor({ location, onSaved }: { location: Location; onSaved?: () => void }) {
  const { reload } = usePortal();
  const [rows, setRows] = useState<DayRow[]>(() => DAYS.map((_, d) => {
    const h = location.hours.find((x) => x.dayOfWeek === d);
    return h ? { open: true, opensAt: h.opensAt.slice(0, 5), closesAt: h.closesAt.slice(0, 5) } : { open: false, opensAt: '11:00', closesAt: '22:00' };
  }));
  const { busy, run, Status } = useAction();
  const set = (d: number, patch: Partial<DayRow>) => setRows((r) => r.map((x, i) => (i === d ? { ...x, ...patch } : x)));
  const save = () => run(async () => {
    await api(`/restaurants/locations/${location.id}/hours`, { method: 'PUT', body: { hours: rows.flatMap((r, d) => (r.open ? [{ dayOfWeek: d, opensAt: r.opensAt, closesAt: r.closesAt }] : [])) } });
    await reload(); onSaved?.();
  });
  return (
    <div className="stack">
      <table className="t">
        <tbody>
          {rows.map((r, d) => (
            <tr key={d}>
              <td style={{ width: 130 }}><b>{DAYS[d]}</b></td>
              <td style={{ width: 60 }}><Switch on={r.open} onChange={(v) => set(d, { open: v })} label={`Open on ${DAYS[d]}`} /></td>
              <td>{r.open ? <div className="row"><input className="input" type="time" value={r.opensAt} onChange={(e) => set(d, { opensAt: e.target.value })} style={{ maxWidth: 140 }} /><span className="muted">to</span><input className="input" type="time" value={r.closesAt} onChange={(e) => set(d, { closesAt: e.target.value })} style={{ maxWidth: 140 }} /></div> : <span className="muted">Closed</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn sm" type="button" onClick={() => setRows((r) => r.map((x) => ({ ...x, open: true, opensAt: r[1].opensAt, closesAt: r[1].closesAt })))}>Copy Monday to every day</button>
        <span className="tiny muted">A closing time before the opening time runs past midnight. 23:59 means until midnight.</span>
      </div>
      <Status />
      <button className="btn primary" style={{ alignSelf: 'flex-start' }} onClick={save} disabled={busy}>Save hours</button>
    </div>
  );
}
