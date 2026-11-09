import { Body, Controller, Delete, Get, Inject, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { TOKENS } from '../common/tokens';
import { parse, run } from '../common/http';
import { AuthUser, CurrentUser } from '../auth/auth.guard';
import { CustomersService } from './customers.service';

const Address = z.object({
  label: z.enum(['home', 'office', 'other']), customLabel: z.string().max(40).optional(),
  line1: z.string().min(3), line2: z.string().optional(), city: z.string().min(2), state: z.string().length(2), postalCode: z.string().regex(/^\d{5}(-\d{4})?$/),
  lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), dropoffInstructions: z.string().max(300).optional(), isDefault: z.boolean().optional(),
});
const Device = z.object({ platform: z.enum(['ios', 'android', 'web']), token: z.string().min(10) });

@Controller('me')
export class CustomersController {
  constructor(@Inject(TOKENS.customers) private readonly customers: CustomersService) {}

  @Get('addresses') list(@CurrentUser() u: AuthUser) { return this.customers.list(u.id); }
  @Post('addresses') add(@CurrentUser() u: AuthUser, @Body() b: unknown) { return run(() => this.customers.add(u.id, parse(Address, b))); }
  @Patch('addresses/:id') update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() b: unknown) { return run(() => this.customers.update(u.id, id, parse(Address.partial(), b))); }
  @Delete('addresses/:id') remove(@CurrentUser() u: AuthUser, @Param('id') id: string) { return run(() => this.customers.remove(u.id, id)); }
  @Post('devices') device(@CurrentUser() u: AuthUser, @Body() b: unknown) { const d = parse(Device, b); return run(() => this.customers.registerDevice(u.id, d.platform, d.token)); }
}
