/**
 * Core API client. Keeps the session in localStorage, refreshes the access token on 401 once,
 * and turns API errors into `ApiError` with a message that can be shown as-is.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/v1';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public body?: unknown) { super(message); }
}

export interface Session { accessToken: string; refreshToken: string; user: { id: string; phone: string; role: string; name: string | null; email: string | null } }

const KEY = 'sk.session';
export function loadSession(): Session | null {
  if (typeof window === 'undefined') return null;
  try { const s = localStorage.getItem(KEY); return s ? (JSON.parse(s) as Session) : null; } catch { return null; }
}
export function saveSession(s: Session | null) {
  try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch { /* private mode */ }
  window.dispatchEvent(new Event('sk-session'));
}

let refreshing: Promise<Session | null> | null = null;
async function refresh(): Promise<Session | null> {
  const s = loadSession();
  if (!s) return null;
  refreshing ??= fetch(`${API_URL}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: s.refreshToken }) })
    .then(async (r) => { if (!r.ok) { saveSession(null); return null; } const next = (await r.json()) as Session; saveSession(next); return next; })
    .catch(() => null)
    .finally(() => { refreshing = null; });
  return refreshing;
}

export async function api<T>(path: string, init: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const doFetch = (token?: string) => fetch(`${API_URL}${path}`, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const session = init.auth === false ? null : loadSession();
  let res = await doFetch(session?.accessToken);
  if (res.status === 401 && session) {
    const next = await refresh();
    if (next) res = await doFetch(next.accessToken);
  }
  const text = await res.text();
  const json = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    const msg = json?.message && typeof json.message === 'string' ? json.message : res.status === 401 ? 'Please sign in.' : 'Something went wrong. Please try again.';
    throw new ApiError(res.status, json?.code ?? 'error', msg, json);
  }
  return json as T;
}

/** Server-Sent Events with the access token (EventSource can't send headers). */
export function liveStream(path: string, onEvent: (type: string, data: unknown) => void) {
  const s = loadSession();
  if (!s) return () => undefined;
  const es = new EventSource(`${API_URL}${path}?access_token=${encodeURIComponent(s.accessToken)}`);
  es.onmessage = (e) => { try { const d = JSON.parse(e.data); onEvent(d.type ?? 'message', d.data ?? d); } catch { /* ignore */ } };
  for (const t of ['order.updated', 'courier.arrived']) es.addEventListener(t, (e) => onEvent(t, JSON.parse((e as MessageEvent).data)));
  return () => es.close();
}
