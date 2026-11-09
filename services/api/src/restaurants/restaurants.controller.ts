import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { TOKENS } from '../common/tokens';
import { centsSchema, parse, phoneSchema, run } from '../common/http';
import { AuthUser, CurrentUser, Roles } from '../auth/auth.guard';
import { RestaurantsService } from './restaurants.service';

const Create = z.object({ name: z.string().min(2).max(80), contactEmail: z.string().email(), cuisine: z.string().max(40).optional() });
const Location = z.object({
  name: z.string().min(2), phone: phoneSchema.optional(), line1: z.string().min(3), city: z.string().min(2), state: z.string().length(2),
  postalCode: z.string().regex(/^\d{5}$/), lat: z.number(), lng: z.number(),
  deliveryRadiusMeters: z.number().int().min(500).max(16000).optional(), prepMinutes: z.number().int().min(5).max(120).optional(),
  pickupEnabled: z.boolean().optional(), deliveryEnabled: z.boolean().optional(),
});
const LocationPatch = Location.partial().extend({ acceptingOrders: z.boolean().optional(), busyMinutes: z.number().int().min(0).max(240).nullable().optional() });
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const Hours = z.object({ hours: z.array(z.object({ dayOfWeek: z.number().int().min(0).max(6), opensAt: hhmm, closesAt: hhmm })).max(28) });
const TaxRate = z.object({ taxRatePpm: z.number().int().min(0).max(200_000) });
const Fee = z.object({
  kind: z.enum(['service_charge', 'mandatory_gratuity', 'packaging_fee', 'large_order_fee']), label: z.string().min(2).max(40),
  rateBps: z.number().int().min(0).max(3000).nullable().optional(), fixedCents: centsSchema.nullable().optional(), minFoodCents: centsSchema.nullable().optional(),
  taxable: z.boolean().optional(), active: z.boolean().optional(),
});
const Rule = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('customer_pays') }),
  z.object({ kind: z.literal('restaurant_pays') }),
  z.object({ kind: z.literal('split_fixed'), restaurantCents: centsSchema }),
  z.object({ kind: z.literal('split_percent'), restaurantBps: z.number().int().min(0).max(10000) }),
  z.object({ kind: z.literal('free_above'), minFoodCents: centsSchema, belowRestaurantCents: centsSchema.optional() }),
]);
const DeliveryRule = z.object({ rule: Rule, perOrderCapCents: centsSchema.nullable().optional(), monthlyBudgetCents: centsSchema.nullable().optional() });
const Teammate = z.object({ phone: phoneSchema, name: z.string().max(80).optional(), role: z.enum(['owner', 'manager', 'staff']) });

@Roles('restaurant_staff', 'admin')
@Controller('restaurants')
export class RestaurantsController {
  constructor(@Inject(TOKENS.restaurants) private readonly r: RestaurantsService) {}

  @Post() create(@CurrentUser() u: AuthUser, @Body() b: unknown) { return run(() => this.r.create(u, parse(Create, b))); }
  @Get('mine') mine(@CurrentUser() u: AuthUser) { return this.r.mine(u); }
  @Get(':id') get(@CurrentUser() u: AuthUser, @Param('id') id: string) { return run(() => this.r.get(u, id)); }
  @Patch(':id') update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: unknown) { return run(() => this.r.update(u, id, parse(Create.partial(), b))); }

  @Post(':id/locations') addLocation(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: unknown) { return run(() => this.r.addLocation(u, id, parse(Location, b))); }
  @Patch('locations/:locationId') updateLocation(@CurrentUser() u: AuthUser, @Param('locationId') id: string, @Body() b: unknown) { return run(() => this.r.updateLocation(u, id, parse(LocationPatch, b))); }
  @Put('locations/:locationId/hours') hours(@CurrentUser() u: AuthUser, @Param('locationId') id: string, @Body() b: unknown) { return run(() => this.r.setHours(u, id, parse(Hours, b).hours)); }
  @Put('locations/:locationId/tax-rate') taxRate(@CurrentUser() u: AuthUser, @Param('locationId') id: string, @Body() b: unknown) { return run(() => this.r.setTaxRate(u, id, parse(TaxRate, b).taxRatePpm)); }

  @Post(':id/tax-responsibility') acceptTax(@CurrentUser() u: AuthUser, @Param('id') id: string) { return run(() => this.r.acceptTaxResponsibility(u, id)); }
  @Post(':id/fees') addFee(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: unknown) { return run(() => this.r.addFee(u, id, parse(Fee, b))); }
  @Patch('fees/:feeId') updateFee(@CurrentUser() u: AuthUser, @Param('feeId') id: string, @Body() b: unknown) { return run(() => this.r.updateFee(u, id, parse(Fee.partial(), b))); }
  @Delete('fees/:feeId') removeFee(@CurrentUser() u: AuthUser, @Param('feeId') id: string) { return run(() => this.r.removeFee(u, id)); }
  @Put(':id/delivery-fee') deliveryRule(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: unknown) { return run(() => this.r.setDeliveryRule(u, id, parse(DeliveryRule, b))); }

  @Get(':id/team') team(@CurrentUser() u: AuthUser, @Param('id') id: string) { return run(() => this.r.team(u, id)); }
  @Post(':id/team') addTeammate(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: unknown) { return run(() => this.r.addTeammate(u, id, parse(Teammate, b))); }
  @Delete(':id/team/:userId') removeTeammate(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('userId') userId: string) { return run(() => this.r.removeTeammate(u, id, userId)); }

  @Post(':id/payouts/onboarding-link') payouts(@CurrentUser() u: AuthUser, @Param('id') id: string) { return run(() => this.r.payoutsLink(u, id)); }
  @Get(':id/stripe/overview') stripeOverview(@CurrentUser() u: AuthUser, @Param('id') id: string) { return run(() => this.r.stripeOverview(u, id)); }
  @Post(':id/stripe/account-session') stripeSession(@CurrentUser() u: AuthUser, @Param('id') id: string) { return run(() => this.r.stripeAccountSession(u, id)); }
  @Post(':id/go-live') goLive(@CurrentUser() u: AuthUser, @Param('id') id: string) { return run(() => this.r.goLive(u, id)); }
}
