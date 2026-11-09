'use client';
/**
 * Stripe tab (owner only). Your restaurant's own Stripe account, inside the portal:
 * a summary we build (setup, payout schedule, bank, balance, payouts) plus Stripe's embedded
 * components for payments, payouts, documents and account details.
 * Refunds and capture aren't offered here: refunds go through the order screen so the
 * Send Koro delivery allocation is refunded correctly, and capture happens when you accept.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadConnectAndInitialize, type StripeConnectInstance } from '@stripe/connect-js/pure';
import {
  ConnectAccountManagement, ConnectAccountOnboarding, ConnectBalances, ConnectComponentsProvider, ConnectDocuments,
  ConnectNotificationBanner, ConnectPayments, ConnectPayouts,
} from '@stripe/react-connect-js';
import { api, ApiError } from '@/lib/api';
import { isOwner, usePortal } from '@/lib/portal';
import { usd } from '@/lib/money';
import type { StripeOverview } from '@/lib/types';

const PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
type Tab = 'overview' | 'payments' | 'payouts' | 'documents' | 'account';
const TABS: [Tab, string][] = [['overview', 'Overview'], ['payments', 'Payments'], ['payouts', 'Payouts'], ['documents', 'Statements & tax forms'], ['account', 'Account & bank']];
const SETUP_TEXT: Record<StripeOverview['setup'], [string, string]> = {
  not_started: ['Not set up', 'Connect a Stripe account so customers can pay you.'],
  pending: ['Stripe is checking', 'Stripe is reviewing your details. This usually takes a few minutes.'],
  restricted: ['Action needed', 'Stripe needs more information before you can take or receive payments.'],
  active: ['Active', 'Customers can pay you, and Stripe pays out to your bank.'],
};

export default function StripeTab() {
  const { restaurant, role } = usePortal();
  const [o, setO] = useState<StripeOverview | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);

  const load = useCallback(async () => {
    if (!restaurant) return;
    try { setO(await api<StripeOverview>(`/restaurants/${restaurant.id}/stripe/overview`)); setError(''); } catch (e) { setError(e instanceof ApiError ? e.message : 'Couldn’t load your Stripe details'); }
  }, [restaurant]);
  useEffect(() => { void load(); }, [load]);

  const connect = useMemo<StripeConnectInstance | null>(() => {
    if (!restaurant || !PK || !o?.stripeAccountId) return null;
    return loadConnectAndInitialize({
      publishableKey: PK,
      fetchClientSecret: async () => {
        const s = await api<{ clientSecret: string | null }>(`/restaurants/${restaurant.id}/stripe/account-session`, { method: 'POST' });
        if (!s.clientSecret) throw new Error('No Stripe account yet');
        return s.clientSecret;
      },
      appearance: { variables: { colorPrimary: '#0B3B6E', colorText: '#0E1E33', colorDanger: '#C81E24', borderRadius: '10px', fontFamily: 'inherit' } },
    });
  }, [restaurant, o?.stripeAccountId]);

  if (!restaurant) return null;
  if (!isOwner(role)) {
    return <div><div className="page-head"><div><h1>Stripe</h1></div></div><div className="note">Only the owner can see the Stripe account (bank details, balance and payouts).</div></div>;
  }

  const startOnboarding = async () => {
    setOpening(true);
    try { const { url } = await api<{ url: string }>(`/restaurants/${restaurant.id}/payouts/onboarding-link`, { method: 'POST' }); window.location.href = url; }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Couldn’t open Stripe'); setOpening(false); }
  };
  const [label, help] = SETUP_TEXT[o?.setup ?? 'not_started'];

  return (
    <div>
      <div className="page-head">
        <div><h1>Stripe</h1><p className="small muted" style={{ margin: '4px 0 0' }}>Your own Stripe account. Food money goes straight here; Send Koro takes no commission.</p></div>
        <a className="btn" href="https://dashboard.stripe.com" target="_blank" rel="noreferrer">Open Stripe Dashboard ↗</a>
      </div>
      {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}
      {o?.error && <div className="note small" style={{ marginBottom: 12 }}>{o.error}</div>}
      {connect && <div style={{ marginBottom: 12 }}><ConnectComponentsProvider connectInstance={connect}><ConnectNotificationBanner /></ConnectComponentsProvider></div>}

      <div className="row" role="tablist" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={`btn sm${tab === k ? ' dark' : ''}`} onClick={() => setTab(k)} disabled={k !== 'overview' && !connect}>{l}</button>)}
      </div>

      {tab === 'overview' && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          <div className="card pad stack">
            <span className="small muted">Account setup</span>
            <div className="row between"><b style={{ fontSize: 20 }}>{label}</b>{o?.ready && <span className="badge green">Ready</span>}</div>
            <span className="small">{help}</span>
            {!!o?.requirementsDue.length && <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{o.requirementsDue.map((r) => <li key={r}>{r}</li>)}</ul>}
            {o?.setup !== 'active' && <button className="btn primary" onClick={startOnboarding} disabled={opening}>{o?.stripeAccountId ? 'Continue setup with Stripe' : 'Connect Stripe'}</button>}
            {o?.stripeAccountId && <span className="tiny muted">Stripe account {o.stripeAccountId}</span>}
          </div>
          <div className="card pad stack">
            <span className="small muted">Balance</span>
            <div className="row between"><span>Available</span><b>{o?.balance ? usd(o.balance.availableCents) : '—'}</b></div>
            <div className="row between"><span>On the way (pending)</span><b>{o?.balance ? usd(o.balance.pendingCents) : '—'}</b></div>
            <span className="tiny muted">Food, tax and your share of fees, after Stripe’s processing fee. Send Koro’s delivery allocation is already taken out.</span>
          </div>
          <div className="card pad stack">
            <span className="small muted">Payouts</span>
            <div className="row between"><span>Schedule</span><b style={{ textAlign: 'right' }}>{o?.payoutSchedule ?? '—'}</b></div>
            <div className="row between"><span>Bank</span><b>{o?.bank ? `${o.bank.name ?? 'Bank'} •••• ${o.bank.last4}` : o?.stripeAccountId ? 'In your Stripe account' : '—'}</b></div>
            <span className="tiny muted">Change the schedule or bank under “Account & bank”. Stripe asks you to sign in to Stripe for these changes.</span>
          </div>
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <table className="t"><thead><tr><th>Recent payouts</th><th>Arrives</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th></tr></thead>
              <tbody>
                {(o?.payouts ?? []).map((p) => <tr key={p.id}><td className="small">{p.id}</td><td>{new Date(p.arrivalDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td><td>{p.status === 'paid' ? 'Paid' : p.status === 'failed' ? `Failed${p.failureMessage ? ': ' + p.failureMessage : ''}` : 'On the way'}</td><td style={{ textAlign: 'right' }}><b>{usd(p.amountCents)}</b></td></tr>)}
                {!o?.payouts.length && <tr><td colSpan={4} className="small muted">No payouts yet.</td></tr>}
              </tbody>
            </table>
          </div>
          {!PK && <div className="note small" style={{ gridColumn: '1 / -1' }}>Stripe’s embedded pages aren’t configured in this build (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).</div>}
        </div>
      )}

      {connect && tab !== 'overview' && (
        <div className="card pad">
          <ConnectComponentsProvider connectInstance={connect}>
            {tab === 'payments' && <><p className="small muted" style={{ marginTop: 0 }}>Every customer payment on your account. To refund, open the order in Order history so the delivery part is refunded correctly.</p><ConnectPayments /></>}
            {tab === 'payouts' && <><ConnectBalances /><div style={{ height: 16 }} /><ConnectPayouts /></>}
            {tab === 'documents' && <><p className="small muted" style={{ marginTop: 0 }}>Monthly statements and tax forms (1099-K) from Stripe.</p><ConnectDocuments /></>}
            {tab === 'account' && (o?.setup === 'active' ? <ConnectAccountManagement /> : <ConnectAccountOnboarding onExit={() => void load()} />)}
          </ConnectComponentsProvider>
        </div>
      )}
    </div>
  );
}
