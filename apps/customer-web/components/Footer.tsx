'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandLogo } from './BrandLogo';

export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="cols">
          <div className="stack">
            <BrandLogo tone="reversed" height={34} />
            <p className="small" style={{ maxWidth: 360 }}>Own a restaurant? Flat plans from $50 a month, first month free, and you keep 100% of food sales.</p>
            <a className="link" href={process.env.NEXT_PUBLIC_RESTAURANT_URL ?? 'https://restaurants.sendkoro.com'}>List your restaurant →</a>
          </div>
          <div><h4>Company</h4><div className="stack small"><Link href="/help">About</Link><a href="mailto:info@shlglobal.biz">Careers</a><Link href="/help#drive">Drive with us</Link></div></div>
          <div><h4>Help</h4><div className="stack small"><Link href="/help">Support</Link><Link href="/help#refunds">Refunds</Link></div></div>
          <div><h4>Legal</h4><div className="stack small"><Link href="/help#terms">Terms</Link><Link href="/help#privacy">Privacy</Link></div></div>
        </div>
        <p className="tiny" style={{ marginTop: 28 }}>© {new Date().getFullYear()} Send Koro · New York, NY · info@shlglobal.biz · +1 917-624-8233</p>
      </div>
    </footer>
  );
}

export function TabBar() {
  const p = usePathname();
  const tab = (href: string, label: string, icon: string) => (
    <Link href={href} className={p === href || (href !== '/' && p.startsWith(href)) ? 'on' : ''}><span aria-hidden style={{ fontSize: 18 }}>{icon}</span>{label}</Link>
  );
  return <nav className="tabbar">{tab('/', 'Home', '⌂')}{tab('/search', 'Search', '⌕')}{tab('/orders', 'Orders', '☰')}{tab('/account', 'Account', '◯')}</nav>;
}
