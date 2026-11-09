import type { Receipt as R } from '@/lib/types';
import { usd } from '@/lib/money';

/** Exactly the lines the API returned — it guarantees they add up to what the card is charged. */
export function Receipt({ receipt, showCommission = true }: { receipt: R; showCommission?: boolean }) {
  return (
    <div className="receipt">
      {receipt.lines.map((l, i) => (
        <div key={i} className={`line ${l.kind === 'delivery_discount' ? 'discount' : ''}`}><span>{l.label}</span><span>{usd(l.amountCents)}</span></div>
      ))}
      {showCommission && <div className="line muted"><span>Send Koro commission</span><span>$0.00</span></div>}
      <div className="total"><span>Total</span><span>{usd(receipt.totalCents)}</span></div>
      <p className="tiny muted" style={{ marginTop: 8 }}>{receipt.taxNote}</p>
    </div>
  );
}
