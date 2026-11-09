import Link from 'next/link';
export default function NotFound() {
  return <div className="container" style={{ paddingTop: 64 }}><div className="card pad center stack" style={{ maxWidth: 420, margin: '0 auto' }}><h2>Page not found</h2><Link className="btn primary" href="/">Back home</Link></div></div>;
}
