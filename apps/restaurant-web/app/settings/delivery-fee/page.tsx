'use client';
import { DeliveryFeeForm } from '@/components/DeliveryFeeForm';
export default function Page() {
  return <div style={{ maxWidth: 760 }}><div className="page-head"><div><h1>Delivery fee</h1><p className="small muted" style={{ margin: '4px 0 0' }}>Choose who pays for delivery. Applies to all your locations.</p></div></div><div className="card pad"><DeliveryFeeForm /></div></div>;
}
