/**
 * The single place order status changes. Conditional UPDATE (status = expected) makes every
 * transition safe against double taps and concurrent jobs; the event log records who did it.
 */
import { and, eq, inArray } from 'drizzle-orm';
import type { Db } from '../db/client';
import { orderEvents, orders, restaurantMembers } from '../db/schema';
import { assertTransition, CUSTOMER_STATUS_TEXT, OrderStatus } from '../core/order-status';
import { conflict, notFound } from '../common/http';
import type { NotificationsService } from '../notifications/notifications.service';

export type Order = typeof orders.$inferSelect;

const STAMP: Partial<Record<OrderStatus, keyof Order>> = {
  placed: 'placedAt', accepted: 'acceptedAt', ready: 'readyAt', picked_up: 'pickedUpAt', delivered: 'deliveredAt', completed: 'deliveredAt', cancelled: 'cancelledAt', declined: 'cancelledAt',
};

export class OrderStateService {
  constructor(private readonly db: Db, private readonly notify: NotificationsService) {}

  async load(id: string) {
    const [o] = await this.db.select().from(orders).where(eq(orders.id, id));
    if (!o) throw notFound('Order');
    return o;
  }

  async transition(id: string, to: OrderStatus, actor: string, extra: Partial<Order> = {}, data?: unknown): Promise<Order> {
    const o = await this.load(id);
    if (o.status === to) return o; // idempotent repeat
    assertTransition(o.status, to);
    const stamp = STAMP[to];
    const set: Partial<Order> = { ...extra, status: to, ...(stamp ? { [stamp]: new Date() } : {}) };
    const [row] = await this.db.update(orders).set(set).where(and(eq(orders.id, id), eq(orders.status, o.status))).returning();
    if (!row) {
      const now = await this.load(id);
      if (now.status === to) return now;
      throw conflict('order_changed', `Order changed to ${now.status} meanwhile`);
    }
    await this.log(id, `status.${to}`, actor, data);
    await this.broadcast(row);
    return row;
  }

  log(orderId: string, type: string, actor: string, data?: unknown) {
    return this.db.insert(orderEvents).values({ orderId, type, actor, data: data ?? null });
  }

  async broadcast(o: Order) {
    const customerView = { id: o.id, code: o.code, status: o.status, statusText: CUSTOMER_STATUS_TEXT[o.status] };
    this.notify.live(`order:${o.id}`, 'order.updated', customerView);
    this.notify.live(`restaurant:${o.restaurantId}`, 'order.updated', { id: o.id, code: o.code, status: o.status, locationId: o.locationId });
    this.notify.live('admin', 'order.updated', { id: o.id, code: o.code, status: o.status, restaurantId: o.restaurantId });
    if (o.status === 'placed') {
      const staff = await this.db.select({ userId: restaurantMembers.userId }).from(restaurantMembers).where(eq(restaurantMembers.restaurantId, o.restaurantId));
      await this.notify.pushTo(staff.map((s) => s.userId), { title: `New order ${o.code}`, body: 'Accept within 5 minutes', data: { orderId: o.id } });
    } else if (['accepted', 'picked_up', 'delivered', 'declined', 'ready'].includes(o.status) && !(o.status === 'ready' && o.fulfilment === 'delivery')) {
      await this.notify.pushTo([o.customerId], { title: o.code, body: CUSTOMER_STATUS_TEXT[o.status], data: { orderId: o.id } });
    }
  }

  byStatus(statuses: OrderStatus[]) { return this.db.select().from(orders).where(inArray(orders.status, statuses)); }
}
