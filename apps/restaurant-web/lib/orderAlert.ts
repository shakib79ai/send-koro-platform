'use client';
/**
 * New-order alert for the Live orders screen.
 * While any order waits for an answer: plays /sounds/new-order.mp3 ("order up": two counter-bell dings and a
 * rising tune) at once and every 10 seconds, flashes the tab title, shows a system notification when the tab is
 * in the background, and keeps the screen on. No screen flashing (owner's decision).
 * Browsers only allow sound after one tap, so the page shows "Turn on order sound" until then.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export const SOUND_KEY = 'sk.sound';
export const RING_EVERY_MS = 10_000;

function readFlag(key: string, fallback: boolean) {
  try { const v = localStorage.getItem(key); return v === null ? fallback : v === 'on'; } catch { return fallback; }
}
export function saveFlag(key: string, on: boolean) {
  try { localStorage.setItem(key, on ? 'on' : 'off'); } catch { /* private mode */ }
}

/** Plays the order sound. Shared by the Live orders screen and "Play the order sound" in Alerts. */
export function useOrderSound() {
  const ctx = useRef<AudioContext | null>(null);
  const buffer = useRef<AudioBuffer | null>(null);
  const [enabled, setEnabled] = useState(false);
  useEffect(() => { setEnabled(readFlag(SOUND_KEY, false)); }, []);

  const load = useCallback(async () => {
    ctx.current ??= new AudioContext();
    if (ctx.current.state === 'suspended') await ctx.current.resume().catch(() => undefined);
    if (!buffer.current) {
      const res = await fetch('/sounds/new-order.mp3');
      buffer.current = await ctx.current.decodeAudioData(await res.arrayBuffer());
    }
    return { c: ctx.current, b: buffer.current };
  }, []);

  const play = useCallback(async (force = false) => {
    if (!enabled && !force) return;
    try {
      const { c, b } = await load();
      const src = c.createBufferSource();
      src.buffer = b;
      src.connect(c.destination);
      src.start();
    } catch { /* audio blocked or file missing: the tab title and notification still alert */ }
  }, [enabled, load]);

  /** Must run inside a tap or click. */
  const enable = useCallback(() => {
    setEnabled(true);
    saveFlag(SOUND_KEY, true);
    void load();
  }, [load]);

  return { enabled, enable, play };
}

/** Rings and notifies while `waiting` (ids of orders that need an answer) is not empty. */
export function useOrderAlert(waiting: string[]) {
  const sound = useOrderSound();
  const { play } = sound;
  const notified = useRef(new Set<string>());
  const count = waiting.length;
  const ids = waiting.join(',');

  // Ring at once and every 10 s until nothing is waiting.
  useEffect(() => {
    if (!count) return;
    const ring = () => { void play(); };
    ring();
    const t = setInterval(ring, RING_EVERY_MS);
    return () => clearInterval(t);
  }, [count, play]);

  // Tab title flashes so a background tab still shows it.
  useEffect(() => {
    if (!count) return;
    const base = document.title;
    let flip = false;
    const t = setInterval(() => { flip = !flip; document.title = flip ? `🔔 ${count} new order${count > 1 ? 's' : ''}` : base; }, 1000);
    return () => { clearInterval(t); document.title = base; };
  }, [count]);

  // System notification once per order, only when the tab is hidden.
  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    for (const id of ids ? ids.split(',') : []) {
      if (notified.current.has(id)) continue;
      notified.current.add(id);
      if (document.visibilityState === 'hidden') {
        try { new Notification('New order', { body: 'Open Send Koro to accept it before the timer runs out.', tag: `order-${id}`, requireInteraction: true }); } catch { /* not allowed */ }
      }
    }
  }, [ids]);

  // Keep the tablet screen on while this screen is open.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const get = async () => { try { lock = await navigator.wakeLock?.request('screen') ?? null; } catch { /* not supported or denied */ } };
    const onVisible = () => { if (document.visibilityState === 'visible') void get(); };
    void get();
    document.addEventListener('visibilitychange', onVisible);
    return () => { document.removeEventListener('visibilitychange', onVisible); void lock?.release().catch(() => undefined); };
  }, []);

  return sound;
}
