import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { TOKENS } from '../common/tokens';
import { centsSchema, parse, run } from '../common/http';
import { AuthUser, CurrentUser, Roles } from '../auth/auth.guard';
import { OrdersService } from './orders.service';

const Line = z.object({ itemId: z.string().uuid(), quantity: z.number().int().min(1).max(50), optionIds: z.array(z.string().uuid()).max(40).optional(), note: z.string().max(200).optional() });
const Checkout = z.object({
  locationId: z.string().uuid(), fulfilment: z.enum(['delivery', 'pickup']), addressId: z.string().uuid().optional(),
  lines: z.array(Line).min(1).max(100), tipCents: centsSchema.max(50_000).default(0), notes: z.string().max(300).optional(),
});
const Place = Checkout.extend({ idempotencyKey: z.string().min(8).max(100), expectedTotalCents: centsSchema });
const Accept = z.object({ prepMinutes: z.number().int().min(1).max(180).optional() });
const Decline = z.object({ reason: z.string().min(2).max(200) });
const History = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional(), limit: z.coerce.number().int().min(1).max(500).optional() });

/** Customer ordering. */
@Roles('customer')
@Controller('orders')
export class CustomerOrdersController {
  constructor(@Inject(TOKENS.orders) private readonly orders: OrdersService) {}

  @Post('preview') async preview(@CurrentUser() u: AuthUser, @Body() b: unknown) {
    return run(async () => {
      const p = await this.orders.preview(u, parse(Checkout, b));
      // stripeAccount: initialise Stripe.js with it (direct charge on the restaurant's account) before placing.
      return { receipt: p.receipt, items: p.cart.lines, etaMinutes: p.etaMinutes, restaurant: p.restaurant, taxNote: p.receipt.taxNote, stripeAccount: p.quote.stripeAccount ?? null };
    });
  }
  @Post() place(@CurrentUser() u: AuthUser, @Body() b: unknown) { return run(() => this.orders.place(u, parse(Place, b))); }
  @Get() list(@CurrentUser() u: AuthUser) { return this.orders.customerOrders(u); }
  @Get(':id') get(@CurrentUser() u: AuthUser, @Param('id') id: string) { return run(() => this.orders.customerOrder(u, id)); }
  @Post(':id/payment-confirmed') confirmed(@CurrentUser() u: AuthUser, @Param('id') id: string) { return run(() => this.orders.confirmPayment(u, id)); }
  @Post(':id/cancel') cancel(@CurrentUser() u: AuthUser, @Param('id') id: string) { return run(() => this.orders.cancelByCustomer(u, id)); }
}

/** Restaurant live orders board and history. */
@Roles('restaurant_staff', 'admin')
@Controller('restaurant-orders')
export class RestaurantOrdersController {
  constructor(@Inject(TOKENS.orders) private readonly orders: OrdersService) {}

  @Get(':restaurantId/live') live(@CurrentUser() u: AuthUser, @Param('restaurantId') id: string, @Query('locationId') locationId?: string) { return run(() => this.orders.liveOrders(u, id, locationId)); }
  @Get(':restaurantId/history') history(@CurrentUser() u: AuthUser, @Param('restaurantId') id: string, @Query() q: unknown) { return run(() => this.orders.history(u, id, parse(History, q))); }
  @Get(':restaurantId/summary') summary(@CurrentUser() u: AuthUser, @Param('restaurantId') id: string, @Query() q: unknown) {
    return run(() => this.orders.summary(u, id, parse(z.object({ from: z.coerce.date(), to: z.coerce.date() }), q)));
  }
  @Post('orders/:id/accept') accept(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: unknown) { return run(() => this.orders.accept(u, id, parse(Accept, b ?? {}).prepMinutes)); }
  @Post('orders/:id/decline') decline(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: unknown) { return run(() => this.orders.decline(u, id, parse(Decline, b).reason)); }
  @Post('orders/:id/preparing') preparing(@CurrentUser() u: AuthUser, @Param('id') id: string) { return run(() => this.orders.markPreparing(u, id)); }
  @Post('orders/:id/ready') ready(@CurrentUser() u: AuthUser, @Param('id') id: string) { return run(() => this.orders.markReady(u, id)); }
  @Post('orders/:id/collected') collected(@CurrentUser() u: AuthUser, @Param('id') id: string) { return run(() => this.orders.markCollected(u, id)); }
}
