'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { usePortal } from '@/lib/portal';
import { BrandLogo } from './BrandLogo';

const NAV: { section?: string; href: string; label: string; icon: string }[] = [
  { href: '/', label: 'Live orders', icon: '◉' },
  { href: '/orders', label: 'Order history', icon: '☰' },
  { href: '/menu', label: 'Menu', icon: '▤' },
  { href: '/earnings', label: 'Earnings & payouts', icon: '$' },
  { href: '/stripe', label: 'Stripe', icon: 'S' },
  { section: 'Settings', href: '/settings/delivery-fee', label: 'Delivery fee', icon: '➜' },
  { href: '/settings/taxes', label: 'Taxes & fees', icon: '%' },
  { href: '/settings/locations', label: 'Locations & area', icon: '⌖' },
  { href: '/settings/hours', label: 'Hours', icon: '◷' },
  { href: '/settings/alerts', label: 'Alerts', icon: '♪' },
  { href: '/settings/team', label: 'Team & roles', icon: '☺' },
  { href: '/plan', label: 'Plan & billing', icon: '▣' },
];
const PUBLIC = ['/sign-in', '/offline'];

export function Shell({ children }: { children: React.ReactNode }) {
  const { session, ready, restaurant, restaurants, select, signOut } = usePortal();
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!session && !PUBLIC.includes(path)) router.replace('/sign-in');
    else if (session && !restaurant && path !== '/setup' && !PUBLIC.includes(path)) router.replace('/setup');
  }, [ready, session, restaurant, path, router]);

  if (PUBLIC.includes(path) || path === '/setup') return <>{children}</>;
  if (!ready || !session || !restaurant) return <div style={{ padding: 40 }} className="muted">Loading…</div>;

  const live = restaurant.status === 'live';
  const on = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
  return (
    <div className="shell">
      <aside className="side">
        <BrandLogo tone="reversed" height={30} />
        <span className="for">FOR RESTAURANTS</span>
        {restaurants.length > 1 ? (
          <select value={restaurant.id} onChange={(e) => select(e.target.value)} aria-label="Restaurant">{restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        ) : <div style={{ padding: '0 10px 8px' }}><b style={{ color: '#fff' }}>{restaurant.name}</b><div className="tiny">{restaurant.locations.length} location{restaurant.locations.length === 1 ? '' : 's'}</div></div>}
        {!live && <Link href="/setup" className="on" style={{ background: 'rgba(255,122,0,.25)' }}>⚑ Finish setup</Link>}
        {NAV.map((n) => (
          <div key={n.href}>
            {n.section && <div className="sect">{n.section}</div>}
            <Link href={n.href} className={on(n.href) ? 'on' : ''}><span aria-hidden style={{ width: 16, textAlign: 'center' }}>{n.icon}</span>{n.label}</Link>
          </div>
        ))}
        <div className="plan">This month: <b>no commission</b><div>You keep 100% of food sales.</div></div>
        <button className="btn sm" style={{ background: 'transparent', color: '#c9cbd1', borderColor: '#2a2d34', marginTop: 8 }} onClick={async () => { await signOut(); router.replace('/sign-in'); }}>Sign out</button>
      </aside>
      <div style={{ minWidth: 0 }}>
        <div className="mobile-top">
          <BrandLogo tone="reversed" height={30} />
          {restaurants.length > 1 ? <select value={restaurant.id} onChange={(e) => select(e.target.value)}>{restaurants.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select> : <b className="small">{restaurant.name}</b>}
        </div>
        <div className="page">{children}</div>
        <nav className="mobile-nav">
          {[['/', 'Live', '◉'], ['/orders', 'History', '☰'], ['/menu', 'Menu', '▤'], ['/earnings', 'Earnings', '$'], ['/more', 'More', '⋯']].map(([h, l, i]) => <Link key={h} href={h} className={on(h) ? 'on' : ''}><span aria-hidden style={{ fontSize: 18 }}>{i}</span>{l}</Link>)}
        </nav>
      </div>
    </div>
  );
}

export { NAV };
