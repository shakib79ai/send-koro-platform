import { Body, Controller, Get, Inject, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { TOKENS } from '../common/tokens';
import { centsSchema, parse, phoneSchema, run } from '../common/http';
import { AuthUser, CurrentUser, Roles } from '../auth/auth.guard';
import { AdminService } from './admin.service';

const Range = z.object({ from: z.coerce.date(), to: z.coerce.date() });
const Refund = z.object({
  requestId: z.string().min(8), reason: z.string().min(3),
  foodCents: centsSchema.optional(), serviceChargeCents: centsSchema.optional(), taxCents: centsSchema.optional(),
  customerDeliveryCents: centsSchema.optional(), restoreSubsidyCents: centsSchema.optional(), tipCents: centsSchema.optional(),
});

@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(@Inject(TOKENS.admin) private readonly admin: AdminService) {}

  @Get('overview') overview() { return this.admin.overview(); }
  @Get('restaurants') restaurants(@Query('q') q?: string) { return this.admin.restaurants(q); }
  @Post('restaurants/:id/status') rStatus(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: unknown) { return run(() => this.admin.setRestaurantStatus(id, parse(z.object({ status: z.enum(['live', 'paused', 'suspended']) }), b).status, u.id)); }
  @Get('drivers') drivers(@Query('status') status?: 'applied' | 'approved' | 'suspended') { return this.admin.drivers(status); }
  @Post('drivers/:id/status') dStatus(@Param('id') id: string, @Body() b: unknown) { return run(() => this.admin.setDriverStatus(id, parse(z.object({ status: z.enum(['approved', 'suspended']) }), b).status)); }
  @Get('orders') orders(@Query() q: unknown) { return this.admin.orders(parse(z.object({ status: z.string().optional(), search: z.string().optional(), limit: z.coerce.number().int().max(500).optional() }), q)); }
  @Get('orders/:id') order(@Param('id') id: string) { return run(() => this.admin.order(id)); }
  @Post('orders/:id/refunds') refund(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: unknown) { return run(() => this.admin.refund(id, parse(Refund, b), `admin:${u.id}`)); }
  @Post('orders/:id/retry-dispatch') retry(@CurrentUser() u: AuthUser, @Param('id') id: string) { return run(() => this.admin.retryDispatch(id, `admin:${u.id}`)); }
  @Get('integrations') integrations() { return this.admin.integrationStatus(); }
  @Get('tax-compliance') tax() { return this.admin.taxCompliance(); }

  // ── Money (from the payments service) ──
  @Get('money/overview') moneyOverview(@Query() q: unknown) { const r = parse(Range, q); return run(() => this.admin.money('overview', { from: r.from.toISOString(), to: r.to.toISOString() })); }
  @Get('money/restaurants/:id') restaurantMoney(@Param('id') id: string, @Query() q: unknown) { const r = parse(Range, q); return run(() => this.admin.money(`restaurants/${id}/money`, { from: r.from.toISOString(), to: r.to.toISOString() })); }
  @Get('money/restaurants/:id/payouts') restaurantPayouts(@Param('id') id: string) { return run(() => this.admin.money(`restaurants/${id}/payouts`)); }
  @Get('money/drivers/:id/payouts') driverPayouts(@Param('id') id: string) { return run(() => this.admin.money(`drivers/${id}/payouts`)); }
  @Get('money/driver-settlements') driverSettlements(@Query() q: Record<string, string>) { return run(() => this.admin.money('driver-settlements', { driverId: q.driverId, status: q.status })); }
  @Post('money/driver-settlements/retry') retryDrivers() { return run(() => this.admin.moneyAction('driver-settlements/retry')); }
  @Get('money/supplier-obligations') suppliers(@Query() q: Record<string, string>) { return run(() => this.admin.money('supplier-obligations', { provider: q.provider, status: q.status })); }
  @Post('money/supplier-obligations/:orderId/reconcile') reconcile(@Param('orderId') orderId: string, @Body() b: unknown) {
    return run(() => this.admin.moneyAction(`supplier-obligations/${orderId}/reconcile`, parse(z.object({ billedCents: centsSchema, tipCents: centsSchema, invoiceRef: z.string().min(1) }), b)));
  }
  @Get('money/billing') billing() { return run(() => this.admin.money('billing')); }

  @Post('admins') addAdmin(@Body() b: unknown) { const x = parse(z.object({ phone: phoneSchema, name: z.string().min(2) }), b); return run(() => this.admin.addAdmin(x.phone, x.name)); }
  @Post('users/:id/disabled') disable(@Param('id') id: string, @Body() b: unknown) { return run(() => this.admin.setUserDisabled(id, parse(z.object({ disabled: z.boolean() }), b).disabled)); }
}
