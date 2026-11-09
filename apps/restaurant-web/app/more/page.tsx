'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePortal } from '@/lib/portal';
import { NAV } from '@/components/Shell';

export default function More() {
  const { signOut } = usePortal();
  const router = useRouter();
  return (
    <div className="stack">
      <h1 style={{ fontSize: 26 }}>More</h1>
      <div className="card">{NAV.filter((n) => !['/', '/orders', '/menu', '/earnings'].includes(n.href)).map((n) => <Link key={n.href} href={n.href} className="row between" style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }}><span>{n.icon} {n.label}</span><span className="muted">›</span></Link>)}</div>
      <button className="btn" onClick={async () => { await signOut(); router.replace('/sign-in'); }}>Sign out</button>
    </div>
  );
}
