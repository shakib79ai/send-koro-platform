import { Body, Controller, Get, Inject, Param, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import { TOKENS } from '../common/tokens';
import { parse, run } from '../common/http';
import { AuthUser, CurrentUser, Roles } from '../auth/auth.guard';
import { DriversService } from './drivers.service';

const Apply = z.object({ name: z.string().min(2).max(80), email: z.string().email(), vehicle: z.enum(['bike', 'ebike', 'car', 'walk']) });
const Point = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
const Online = z.object({ online: z.boolean(), lat: z.number().optional(), lng: z.number().optional() });
const Delivered = z.object({ proofPhotoUrl: z.string().url().optional() });

@Roles('driver')
@Controller('driver')
export class DriversController {
  constructor(@Inject(TOKENS.drivers) private readonly drivers: DriversService) {}

  @Get('me') me(@CurrentUser() u: AuthUser) { return this.drivers.me(u); }
  @Post('apply') apply(@CurrentUser() u: AuthUser, @Body() b: unknown) { return run(() => this.drivers.apply(u, parse(Apply, b))); }
  @Post('payouts/onboarding-link') payouts(@CurrentUser() u: AuthUser) { return run(() => this.drivers.payoutsLink(u)); }
  @Get('stripe/overview') stripeOverview(@CurrentUser() u: AuthUser) { return run(() => this.drivers.stripeOverview(u)); }
  @Post('stripe/account-session') stripeSession(@CurrentUser() u: AuthUser) { return run(() => this.drivers.stripeAccountSession(u)); }
  @Put('online') online(@CurrentUser() u: AuthUser, @Body() b: unknown) {
    const x = parse(Online, b);
    return run(() => this.drivers.setOnline(u, x.online, x.lat != null && x.lng != null ? { lat: x.lat, lng: x.lng } : undefined));
  }
  @Put('location') location(@CurrentUser() u: AuthUser, @Body() b: unknown) { return run(() => this.drivers.updateLocation(u, parse(Point, b))); }
  @Get('offers') offers(@CurrentUser() u: AuthUser) { return run(() => this.drivers.openOffers(u)); }
  @Post('offers/:id/accept') accept(@CurrentUser() u: AuthUser, @Param('id') id: string) { return run(() => this.drivers.acceptOffer(u, id)); }
  @Post('offers/:id/decline') decline(@CurrentUser() u: AuthUser, @Param('id') id: string) { return run(() => this.drivers.declineOffer(u, id)); }
  @Get('trip') trip(@CurrentUser() u: AuthUser) { return run(() => this.drivers.currentTrip(u)); }
  @Post('deliveries/:orderId/arrived') arrived(@CurrentUser() u: AuthUser, @Param('orderId') id: string) { return run(() => this.drivers.arrivedAtPickup(u, id)); }
  @Post('deliveries/:orderId/picked-up') pickedUp(@CurrentUser() u: AuthUser, @Param('orderId') id: string) { return run(() => this.drivers.pickedUp(u, id)); }
  @Post('deliveries/:orderId/delivered') delivered(@CurrentUser() u: AuthUser, @Param('orderId') id: string, @Body() b: unknown) { return run(() => this.drivers.delivered(u, id, parse(Delivered, b ?? {}).proofPhotoUrl)); }
  @Get('earnings') earnings(@CurrentUser() u: AuthUser) { return run(() => this.drivers.earnings(u)); }
  @Get('history') history(@CurrentUser() u: AuthUser) { return run(() => this.drivers.history(u)); }
}
