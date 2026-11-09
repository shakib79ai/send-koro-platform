'use client';
import { useEffect, useState } from 'react';
import { Switch } from '@/components/ui';
import { SOUND_KEY, saveFlag, useOrderSound } from '@/lib/orderAlert';

export default function Alerts() {
  const [sound, setSound] = useState(false);
  const [perm, setPerm] = useState<string>('default');
  const { play } = useOrderSound();
  useEffect(() => {
    try { setSound(localStorage.getItem(SOUND_KEY) === 'on'); } catch { /* ignore */ }
    if (typeof Notification !== 'undefined') setPerm(Notification.permission);
  }, []);
  const toggleSound = (v: boolean) => { setSound(v); saveFlag(SOUND_KEY, v); if (v) void play(true); };
  return (
    <div style={{ maxWidth: 760 }}>
      <div className="page-head"><div><h1>Alerts</h1><p className="small muted" style={{ margin: '4px 0 0' }}>How this device tells you about new orders.</p></div></div>
      <div className="card pad stack">
        <div className="row between"><div><b>Order sound on this device</b><div className="small muted">Two bell dings and a short tune, every 10 seconds until someone answers. The tab title flashes too.</div></div><Switch on={sound} onChange={toggleSound} label="Order sound" /></div>
        <div className="row between"><div><b>Notifications</b><div className="small muted">{perm === 'granted' ? 'On for this device.' : perm === 'denied' ? 'Blocked — allow notifications in your browser settings.' : 'Get a notification even when this tab is in the background.'}</div></div>
          {perm !== 'granted' && perm !== 'denied' && <button className="btn sm" onClick={async () => setPerm(await Notification.requestPermission())}>Allow</button>}</div>
        <div><button className="btn sm" onClick={() => void play(true)}>Play the order sound</button></div>
        <div className="note small">Tip: install this app on your tablet (Share → Add to Home Screen, or the install icon in Chrome’s address bar), keep the volume up and leave it open on the Live orders screen. The screen stays on while that page is open. Order printers can be added later.</div>
      </div>
    </div>
  );
}
