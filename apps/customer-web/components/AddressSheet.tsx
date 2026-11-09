'use client';
import Link from 'next/link';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { AddressForm, AddressDraft } from './AddressForm';
import { labelOf } from './Header';

export function AddressSheet({ onClose }: { onClose: () => void }) {
  const { session, addresses, selectedAddress, selectAddress, reloadAddresses } = useSession();
  const [adding, setAdding] = useState(addresses.length === 0);
  const save = async (a: AddressDraft) => {
    const created = await api<{ id: string }>('/me/addresses', { body: a });
    await reloadAddresses();
    selectAddress(created.id);
    onClose();
  };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Deliver to">
        <div className="hd row between"><h2>Deliver to</h2><button className="btn sm" onClick={onClose}>Close</button></div>
        <div className="bd stack">
          {!session ? (
            <div className="stack"><p className="muted">Sign in to save Home, Office and other addresses.</p><Link className="btn primary" href="/sign-in" onClick={onClose}>Sign in / Sign up</Link></div>
          ) : adding ? (
            <AddressForm onSave={save} />
          ) : (
            <>
              {addresses.map((a) => (
                <button key={a.id} className={`addr-opt ${selectedAddress?.id === a.id ? 'on' : ''}`} onClick={() => { selectAddress(a.id); onClose(); }}>
                  <div><div className="bold">{labelOf(a)}{a.isDefault && <span className="badge gray" style={{ marginLeft: 8 }}>Default</span>}</div><div className="small muted">{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}</div></div>
                </button>
              ))}
              <button className="btn" onClick={() => setAdding(true)}>+ Add an address</button>
              <Link href="/account" className="link small" onClick={onClose}>Edit addresses</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
