/**
 * Refund allocation — brief §"Refund allocation".
 * Separate components; Stripe does NOT return application fees automatically, so the delivery
 * allocation is returned explicitly with an application-fee refund.
 */
import type { Allocation, Cents } from './allocation';

export interface RefundRequest {
  foodCents: Cents;
  serviceChargeCents: Cents;
  taxCents: Cents;
  /** Return the customer's delivery contribution (C) — only when delivery was not fulfilled, or by explicit decision. */
  customerDeliveryCents: Cents;
  /** Return the restaurant's subsidy (R) from the delivery allocation back to the restaurant. */
  restoreSubsidyCents: Cents;
  tipCents: Cents;
  reason: string;
}

export interface AlreadyRefunded {
  foodCents: Cents; serviceChargeCents: Cents; taxCents: Cents;
  customerDeliveryCents: Cents; restoreSubsidyCents: Cents; tipCents: Cents;
}

export interface RefundContext {
  allocation: Allocation;
  already: AlreadyRefunded;
  deliveryFulfilled: boolean;
  /** Driver or supplier has already been paid the tip — it must not be clawed back automatically. */
  tipSettled: boolean;
}

export interface RefundPlan {
  /** Refund on the direct charge (restaurant connected account) → back to the customer's card. */
  chargeRefundCents: Cents;
  /** Application fee refund (platform → restaurant account). */
  applicationFeeRefundCents: Cents;
  /** Amount deducted from the restaurant's subscription tier base (food refunds only). */
  tierBaseDeductionCents: Cents;
  components: RefundRequest;
}

export class RefundError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = 'RefundError'; }
}

export const emptyRefunded = (): AlreadyRefunded => ({ foodCents: 0, serviceChargeCents: 0, taxCents: 0, customerDeliveryCents: 0, restoreSubsidyCents: 0, tipCents: 0 });

export function planRefund(req: RefundRequest, ctx: RefundContext): RefundPlan {
  const a = ctx.allocation;
  const caps: Record<keyof AlreadyRefunded, Cents> = {
    foodCents: a.F, serviceChargeCents: a.S, taxCents: a.X,
    customerDeliveryCents: a.C, restoreSubsidyCents: a.R, tipCents: a.T,
  };
  for (const k of Object.keys(caps) as (keyof AlreadyRefunded)[]) {
    const v = req[k];
    if (!Number.isInteger(v) || v < 0) throw new RefundError('invalid_amount', `${k} must be non-negative integer cents`);
    if (ctx.already[k] + v > caps[k]) throw new RefundError('over_refund', `${k}: ${ctx.already[k] + v}¢ exceeds original ${caps[k]}¢`);
  }
  if (ctx.deliveryFulfilled && (req.customerDeliveryCents > 0 || req.restoreSubsidyCents > 0) && !/^delivery_/.test(req.reason)) {
    // A fulfilled delivery is not refunded proportionally with food; use an explicit delivery_* reason.
    throw new RefundError('delivery_fulfilled', 'Delivery was fulfilled — refund delivery only with an explicit delivery_* reason');
  }
  if (ctx.tipSettled && req.tipCents > 0) {
    throw new RefundError('tip_settled', 'Tip already paid to the courier — it is not clawed back automatically');
  }
  const chargeRefundCents = req.foodCents + req.serviceChargeCents + req.taxCents + req.customerDeliveryCents + req.tipCents;
  // The platform took D + T. Whatever of C and T goes back to the customer, plus any restored
  // restaurant subsidy, must come back out of the platform's application fee.
  const applicationFeeRefundCents = req.customerDeliveryCents + req.restoreSubsidyCents + req.tipCents;
  if (chargeRefundCents === 0 && applicationFeeRefundCents === 0) throw new RefundError('empty', 'Nothing to refund');
  return { chargeRefundCents, applicationFeeRefundCents, tierBaseDeductionCents: req.foodCents, components: req };
}

/** Full cancellation before fulfilment: customer gets everything back, restaurant subsidy restored. */
export function fullCancellation(a: Allocation): RefundRequest {
  return {
    foodCents: a.F, serviceChargeCents: a.S, taxCents: a.X,
    customerDeliveryCents: a.C, restoreSubsidyCents: a.R, tipCents: a.T,
    reason: 'cancelled_before_fulfillment',
  };
}
