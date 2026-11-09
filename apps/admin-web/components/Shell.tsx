'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAdmin } from '@/lib/admin';
import { BrandLogo } from './BrandLogo';

const NAV: { section?: string; href: string; label: string; icon: string }[] = [
  { href: '/', label: 'Operations', icon: '◉' },
  { href: '/orders', label: 'Orders', icon: '☰' },
  { href: '/dispatch', label: 'Dispatch & integrations', icon: '➜' },
  { section: 'Partners', href: '/restaurants', label: 'Restaurants', icon: '▤' },
  { href: '/drivers', label: 'Drivers', icon: '☺' },
  { section: 'Money', href: '/payouts', label: 'Restaurant payouts', icon: '$' },
  { href: '/settlements', label: 'Driver & courier settlements', icon: '⇄' },
  { href: '/billing', label: 'Billing & platform', icon: '▣' },
  { href: '/taxes', label: 'Taxes & compliance', icon: '%' },
  { section: 'Team', href: '/admins', label: 'Admins', icon: '⚙' },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const { session, ready, signOut } = useAdmin();
  const path = usePathname();
  const router = useRouter();
  useEffect(() => { if (ready && !session && path !== '/sign-in') router.replace('/sign-in'); }, [ready, session, path, router]);
  if (path === '/sign-in') return <>{children}</>;
  if (!ready || !session) return <div style={{ padding: 40 }} className="muted">Loading…</div>;
  const on = (href: string) => (href === '/' ? path === '/' : path.startsWith(href));
  return (
    <div className="shell">
      <aside className="side">
        <BrandLogo tone="reversed" height={30} />
        <span className="for">ADMIN</span>
        {NAV.map((n) => (
          <div key={n.href}>
            {n.section && <div className="sect">{n.section}</div>}
            <Link href={n.href} className={on(n.href) ? 'on' : ''}><span aria-hidden style={{ width: 16, textAlign: 'center' }}>{n.icon}</span>{n.label}</Link>
          </div>
        ))}
        <div className="plan" style={{ marginTop: 'auto' }}>{session.user.name ?? session.user.phone}<div className="tiny">Customers never see courier names. Admin does.</div></div>
        <button className="btn sm" style={{ background: 'transparent', color: '#c9cbd1', borderColor: '#2a2d34', marginTop: 8 }} onClick={async () => { await signOut(); router.replace('/sign-in'); }}>Sign out</button>
      </aside>
      <div style={{ minWidth: 0 }}>
        <div className="mobile-top"><BrandLogo tone="reversed" height={26} label="Admin" /><select onChange={(e) => router.push(e.target.value)} value={NAV.find((n) => on(n.href))?.href}>{NAV.map((n) => <option key={n.href} value={n.href}>{n.label}</option>)}</select></div>
        <div className="page">{children}</div>
      </div>
    </div>
  );
}
