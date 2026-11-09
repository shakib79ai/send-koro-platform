'use client';
/** Stripe sends the owner here when an onboarding link expired (OnboardingService refresh_url): open a fresh one. */
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { usePortal } from '@/lib/portal';

export default function StripeRefresh() {
  const { restaurant } = usePortal();
  const [error, setError] = useState('');
  useEffect(() => {
    if (!restaurant) return;
    api<{ url: string }>(`/restaurants/${restaurant.id}/payouts/onboarding-link`, { method: 'POST' })
      .then(({ url }) => { window.location.href = url; })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Couldn’t open Stripe'));
  }, [restaurant]);
  return <div className="card pad" style={{ maxWidth: 560 }}>{error ? <span className="error">{error}</span> : 'Opening Stripe…'}</div>;
}
