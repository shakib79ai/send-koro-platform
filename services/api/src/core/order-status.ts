/** Order lifecycle. Every change goes through `assertTransition`. */
export type OrderStatus = 'pending_payment' | 'placed' | 'accepted' | 'preparing' | 'ready' | 'picked_up' | 'delivered' | 'completed' | 'declined' | 'cancelled';

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ['placed', 'cancelled'],
  placed: ['accepted', 'declined', 'cancelled'],
  accepted: ['preparing', 'ready', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['picked_up', 'completed', 'cancelled'], // completed = customer collected a pickup order
  picked_up: ['delivered'],
  delivered: [],
  completed: [],
  declined: [],
  cancelled: [],
};

export class TransitionError extends Error {
  constructor(public readonly from: OrderStatus, public readonly to: OrderStatus) { super(`Order cannot go from ${from} to ${to}`); }
}

export function canTransition(from: OrderStatus, to: OrderStatus) { return NEXT[from].includes(to); }
export function assertTransition(from: OrderStatus, to: OrderStatus) { if (!canTransition(from, to)) throw new TransitionError(from, to); }

/** Customer-facing wording. Never mentions the courier company. */
export const CUSTOMER_STATUS_TEXT: Record<OrderStatus, string> = {
  pending_payment: 'Waiting for payment',
  placed: 'Waiting for the restaurant to accept',
  accepted: 'Order accepted',
  preparing: 'Preparing your order',
  ready: 'Ready',
  picked_up: 'On the way',
  delivered: 'Delivered',
  completed: 'Picked up',
  declined: 'The restaurant couldn’t take this order. Your card was not charged.',
  cancelled: 'Cancelled',
};
