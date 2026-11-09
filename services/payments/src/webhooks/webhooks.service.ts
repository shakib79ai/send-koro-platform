/**
 * Webhooks — brief §"Required records and controls": verify signatures, dedupe, tolerate retries
 * and out-of-order delivery. Three endpoints:
 *   platform   (/webhooks/stripe)          events on Send Koro's own account (fees, transfers, billing)
 *   connect    (/webhooks/stripe/connect)  events on restaurant/driver accounts (direct charges, refunds, disputes, payouts)
 *   thin v2    (/webhooks/stripe/v2)       Accounts v2 status changes (event destination, thin payload)
 */
import type Stripe from 'stripe';
import { eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { driverTransfers, orders, stripeEvents } from '../db/schema';
import { LedgerService } from '../payments/ledger.service';
import { OnboardingService } from '../payments/onboarding.service';
import { SettlementService } from '../payments/settlement.service';
import { SubscriptionsService } from '../payments/subscriptions.service';

export interface WebhookSecrets { platform: string; connect: string; thin?: string }
export type FulfilmentTrigger = (orderId: string) => Promise<void>;

export class WebhooksService {
  constructor(
    private readonly stripe: Stripe,
    private readonly db: Db,
    private readonly secrets: WebhookSecrets,
    private readonly ledger: LedgerService,
    private readonly settlement: SettlementService,
    private readonly subscriptions: SubscriptionsService,
    private readonly onboarding: OnboardingService,
    private readonly startFulfilment: FulfilmentTrigger,
  ) {}

  verify(kind: 'platform' | 'connect', rawBody: Buffer | string, signature: string | undefined): Stripe.Event {
    if (!signature) throw new Error('Missing Stripe-Signature header');
    return this.stripe.webhooks.constructEvent(rawBody, signature, kind === 'platform' ? this.secrets.platform : this.secrets.connect);
  }

  /** Returns false when the event was already processed (duplicate delivery). */
  async handle(event: Stripe.Event): Promise<boolean> {
    const inserted = await this.db.insert(stripeEvents).values({ id: event.id, type: event.type, account: event.account ?? null })
      .onConflictDoNothing().returning();
    if (!inserted.length) {
      const [prev] = await this.db.select().from(stripeEvents).where(eq(stripeEvents.id, event.id));
      if (prev?.processedAt) return false; // processed before → acknowledge
    }
    try {
      await this.dispatch(event);
      await this.db.update(stripeEvents).set({ processedAt: new Date(), error: null }).where(eq(stripeEvents.id, event.id));
      return true;
    } catch (e) {
      await this.db.update(stripeEvents).set({ error: (e as Error).message }).where(eq(stripeEvents.id, event.id));
      throw e; // non-2xx → Stripe retries
    }
  }

  private async dispatch(event: Stripe.Event) {
    switch (event.type) {
      case 'payment_intent.amount_capturable_updated': {
        const pi = event.data.object;
        if (pi.metadata?.send_koro_order_id) {
          await this.db.update(orders).set({ status: 'authorized' })
            .where(sql`${orders.id} = ${pi.metadata.send_koro_order_id} and ${orders.status} = 'awaiting_payment'`);
        }
        return;
      }
      case 'payment_intent.succeeded': {
        if (!event.account) return; // direct charges are always on a connected account
        const res = await this.ledger.recordPaid(event.data.object, event.account);
        if (res?.firstTime) await this.startFulfilment(res.orderId);
        return;
      }
      case 'payment_intent.payment_failed': {
        const id = event.data.object.metadata?.send_koro_order_id;
        if (id) await this.db.update(orders).set({ status: 'payment_failed' }).where(sql`${orders.id} = ${id} and ${orders.status} <> 'paid'`);
        return;
      }
      case 'payment_intent.canceled': {
        const id = event.data.object.metadata?.send_koro_order_id;
        if (id) await this.db.update(orders).set({ status: 'cancelled' }).where(sql`${orders.id} = ${id} and ${orders.status} in ('awaiting_payment','authorized','declined')`);
        return;
      }
      case 'charge.dispute.created': {
        const chargeId = typeof event.data.object.charge === 'string' ? event.data.object.charge : event.data.object.charge.id;
        const [o] = await this.db.select().from(orders).where(eq(orders.chargeId, chargeId));
        if (o) {
          await this.db.update(orders).set({ status: 'disputed' }).where(eq(orders.id, o.id));
          await this.settlement.holdForDispute(o.id);
        }
        return;
      }
      case 'application_fee.created': {
        const fee = event.data.object;
        const chargeId = typeof fee.charge === 'string' ? fee.charge : fee.charge.id;
        await this.db.update(orders).set({ applicationFeeId: fee.id }).where(eq(orders.chargeId, chargeId));
        return;
      }
      case 'transfer.reversed': {
        await this.db.update(driverTransfers).set({ status: 'reversed' }).where(eq(driverTransfers.stripeTransferId, event.data.object.id));
        return;
      }
      case 'payout.failed': {
        // Driver/restaurant bank payout failed — the connected account's Stripe balance is unchanged; notify them.
        return;
      }
      case 'invoice.created':
        await this.subscriptions.onInvoiceCreated(event.data.object);
        return;
      case 'invoice.payment_failed':
      case 'invoice.paid':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        return; // status sync / dunning notifications hook in here
      default:
        return;
    }
  }

  /** Accounts v2 thin events → re-fetch the account and sync capability status. */
  async handleThin(rawBody: Buffer | string, signature: string | undefined) {
    if (!this.secrets.thin) throw new Error('STRIPE_THIN_EVENTS_SECRET not configured');
    if (!signature) throw new Error('Missing Stripe-Signature header');
    const n = this.stripe.parseEventNotification(rawBody, signature, this.secrets.thin);
    const related = (n as { related_object?: { id: string } | null }).related_object ?? null;
    const inserted = await this.db.insert(stripeEvents).values({ id: n.id, type: n.type, account: related?.id ?? null }).onConflictDoNothing().returning();
    if (!inserted.length) return false;
    if (n.type.startsWith('v2.core.account') && related?.id) await this.onboarding.syncAccount(related.id);
    await this.db.update(stripeEvents).set({ processedAt: new Date() }).where(eq(stripeEvents.id, n.id));
    return true;
  }
}

export const PLATFORM_EVENTS = ['application_fee.created', 'application_fee.refunded', 'transfer.created', 'transfer.reversed', 'balance.available', 'invoice.created', 'invoice.paid', 'invoice.payment_failed', 'customer.subscription.updated', 'customer.subscription.deleted', 'checkout.session.completed'] as const;
export const CONNECT_EVENTS = ['payment_intent.amount_capturable_updated', 'payment_intent.succeeded', 'payment_intent.payment_failed', 'payment_intent.canceled', 'charge.refunded', 'refund.updated', 'charge.dispute.created', 'charge.dispute.closed', 'payout.paid', 'payout.failed'] as const;
export const THIN_EVENTS = ['v2.core.account[configuration.merchant].capability_status_updated', 'v2.core.account[configuration.recipient].capability_status_updated', 'v2.core.account[configuration.customer].capability_status_updated', 'v2.core.account[requirements].updated'] as const;
