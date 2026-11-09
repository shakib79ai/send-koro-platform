import { BadRequestException, Body, Controller, Get, Inject, Param, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AllocationError } from '../core/allocation';
import { RefundError } from '../core/refunds';
import { TOKENS } from '../tokens';
import { InternalApiGuard } from '../internal-api.guard';
import { CheckoutService } from './checkout.service';
import { OnboardingService } from './onboarding.service';
import { RefundsService } from './refunds.service';
import { SettlementService } from './settlement.service';
import { SubscriptionsService } from './subscriptions.service';
import { RegistryService } from './registry.service';
import { ConnectDashboardService } from './connect-dashboard.service';

const cents = z.number().int().nonnegative();
const QuoteBody = z.object({
  restaurantId: z.string().uuid(),
  foodCents: cents,
  serviceChargeCents: cents.optional(),
  taxCents: cents.optional(),
  taxBreakdown: z.array(z.object({ label: z.string(), rateBps: z.number().int(), amountCents: cents })).optional(),
  tipCents: cents.optional(),
  delivery: z.discriminatedUnion('provider', [
    z.object({ provider: z.literal('pickup') }),
    z.object({ provider: z.enum(['uber_direct', 'doordash_drive', 'own_driver']), providerQuoteId: z.string().optional(), deliveryCents: cents, expiresAt: z.coerce.date() }),
  ]),
});
const RefundBody = z.object({
  requestId: z.string().min(8),
  foodCents: cents.default(0), serviceChargeCents: cents.default(0), taxCents: cents.default(0),
  customerDeliveryCents: cents.default(0), restoreSubsidyCents: cents.default(0), tipCents: cents.default(0),
  reason: z.string().min(3),
});

const PartyBody = z.object({ id: z.string().uuid(), name: z.string().min(1), contactEmail: z.string().email() });
const ConsentBody = z.object({
  rule: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('customer_pays') }),
    z.object({ kind: z.literal('restaurant_pays') }),
    z.object({ kind: z.literal('split_fixed'), restaurantCents: cents }),
    z.object({ kind: z.literal('split_percent'), restaurantBps: z.number().int().min(0).max(10000) }),
    z.object({ kind: z.literal('free_above'), minFoodCents: cents, belowRestaurantCents: cents.optional() }),
  ]),
  perOrderCapCents: cents.nullable().optional(),
  monthlyBudgetCents: cents.nullable().optional(),
  acceptedBy: z.string().min(1),
});

function parse<S extends z.ZodTypeAny>(schema: S, body: unknown): z.output<S> {
  const r = schema.safeParse(body);
  if (!r.success) throw new BadRequestException(r.error.issues);
  return r.data;
}
async function domain<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); } catch (e) {
    if (e instanceof AllocationError || e instanceof RefundError) throw new BadRequestException({ code: e.code, message: e.message });
    throw e;
  }
}

/** Internal API used by the Send Koro apps' backend (never called directly from browsers). */
@UseGuards(InternalApiGuard)
@Controller()
export class PaymentsController {
  constructor(
    @Inject(TOKENS.checkout) private readonly checkout: CheckoutService,
    @Inject(TOKENS.onboarding) private readonly onboarding: OnboardingService,
    @Inject(TOKENS.refunds) private readonly refunds: RefundsService,
    @Inject(TOKENS.settlement) private readonly settlement: SettlementService,
    @Inject(TOKENS.subscriptions) private readonly subs: SubscriptionsService,
    @Inject(TOKENS.registry) private readonly registry: RegistryService,
    @Inject(TOKENS.connectDashboard) private readonly connect: ConnectDashboardService,
  ) {}

  // ── Registry (called by services/api) ──
  @Post('registry/restaurants') upsertRestaurant(@Body() b: unknown) { return this.registry.upsertRestaurant(parse(PartyBody, b)); }
  @Post('registry/drivers') upsertDriver(@Body() b: unknown) { return this.registry.upsertDriver(parse(PartyBody, b)); }
  @Get('restaurants/:id/status') rStatus(@Param('id') id: string) { return this.registry.restaurantStatus(id); }
  @Get('drivers/:id/status') dStatus(@Param('id') id: string) { return this.registry.driverStatus(id); }
  @Post('restaurants/:id/tax-responsibility') acceptTax(@Param('id') id: string) { return this.registry.acceptTaxResponsibility(id); }
  @Post('restaurants/:id/delivery-consents') consent(@Param('id') id: string, @Body() b: unknown) {
    return domain(() => this.registry.setDeliveryConsent(id, parse(ConsentBody, b)));
  }
  @Post('restaurants/:id/stripe/account') async rAccount(@Param('id') id: string) { return { accountId: await this.onboarding.createRestaurantAccount(id) }; }
  @Post('drivers/:id/stripe/account') async dAccount(@Param('id') id: string) { return { accountId: await this.onboarding.createDriverAccount(id) }; }

  @Post('checkout/quotes') quote(@Body() body: unknown) { return domain(() => this.checkout.quote(parse(QuoteBody, body))); }
  @Post('checkout/quotes/:id/payment') pay(@Param('id') id: string) { return domain(() => this.checkout.createPayment(id)); }
  @Get('orders/:id/payment-status') status(@Param('id') id: string) { return this.checkout.paymentStatus(id); }
  @Post('orders/:id/accept') accept(@Param('id') id: string) { return this.checkout.accept(id); }
  @Post('orders/:id/decline') decline(@Param('id') id: string, @Body() b: { reason?: 'restaurant_declined' | 'auto_declined' | 'customer_cancelled' }) { return this.checkout.decline(id, b?.reason ?? 'restaurant_declined'); }
  @Post('orders/:id/refunds') refund(@Param('id') id: string, @Body() body: unknown) {
    const { requestId, ...req } = parse(RefundBody, body);
    return domain(() => this.refunds.refund(id, req, requestId));
  }

  @Post('restaurants/:id/stripe/onboarding-link') async rLink(@Param('id') id: string) { return { url: await this.onboarding.restaurantOnboardingLink(id) }; }
  @Post('drivers/:id/stripe/onboarding-link') async dLink(@Param('id') id: string) { return { url: await this.onboarding.driverOnboardingLink(id) }; }
  // ── Stripe tab in the restaurant portal and driver app ──
  @Post('restaurants/:id/stripe/account-session') rSession(@Param('id') id: string) { return this.connect.accountSession('restaurant', id); }
  @Post('drivers/:id/stripe/account-session') dSession(@Param('id') id: string) { return this.connect.accountSession('driver', id); }
  @Get('restaurants/:id/stripe/overview') rOverview(@Param('id') id: string) { return this.connect.overview('restaurant', id); }
  @Get('drivers/:id/stripe/overview') dOverview(@Param('id') id: string) { return this.connect.overview('driver', id); }
  @Post('stripe/accounts/:acct/sync') sync(@Param('acct') acct: string) { return this.onboarding.syncAccount(acct); }

  @Post('restaurants/:id/subscription') sub(@Param('id') id: string) { return this.subs.ensureRestaurantSubscription(id); }
  @Post('restaurants/:id/subscription/payment-method') async pm(@Param('id') id: string, @Body() b: { returnUrl: string }) { return { url: await this.subs.paymentMethodSetupUrl(id, b.returnUrl) }; }

  @Post('fulfilment/:orderId/own-driver-delivered') delivered(@Param('orderId') orderId: string, @Body() b: { driverId: string; driverPayCents: number }) {
    return this.settlement.ownDriverDelivered(orderId, b.driverId, parse(cents, b.driverPayCents));
  }
  @Post('fulfilment/:orderId/supplier-assigned') assigned(@Param('orderId') orderId: string, @Body() b: { provider: 'uber_direct' | 'doordash_drive'; providerDeliveryId: string }) {
    return this.settlement.supplierAssigned(orderId, b.provider, b.providerDeliveryId);
  }
  @Post('drivers/:id/nyc-top-ups') topUp(@Param('id') id: string, @Body() b: unknown) {
    const x = parse(z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), tripSeconds: z.number().int().nonnegative(), paidCents: cents }), b);
    return this.settlement.weeklyTopUp(id, x.weekStart, x.tripSeconds, x.paidCents);
  }
  @Post('fulfilment/:orderId/supplier-tip-submitted') tip(@Param('orderId') orderId: string) { return this.settlement.markTipSubmitted(orderId); }
}
