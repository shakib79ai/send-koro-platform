'use client';
/** Stripe sends the owner back here after hosted onboarding (OnboardingService return_url). */
import Link from 'next/link';

export default function StripeReturn() {
  return (
    <div style={{ maxWidth: 560 }}>
      <div className="page-head"><div><h1>Thanks — back from Stripe</h1></div></div>
      <div className="card pad stack">
        <p style={{ margin: 0 }}>Stripe is checking your details. This usually takes a few minutes; we update your status automatically.</p>
        <Link className="btn primary" href="/stripe">See your Stripe account</Link>
      </div>
    </div>
  );
}
