import { Body, Controller, Get, Inject, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { TOKENS } from '../common/tokens';
import { parse, phoneSchema, run } from '../common/http';
import { AuthService } from './auth.service';
import { AuthUser, CurrentUser, Public } from './auth.guard';

const role = z.enum(['customer', 'restaurant_staff', 'driver', 'admin']);
const RequestBody = z.object({ phone: phoneSchema, role });
const VerifyBody = z.object({ phone: phoneSchema, role, code: z.string().regex(/^\d{6}$/), name: z.string().min(1).max(80).optional(), email: z.string().email().optional() });
const RefreshBody = z.object({ refreshToken: z.string().min(20) });
const MeBody = z.object({ name: z.string().min(1).max(80).optional(), email: z.string().email().optional() });

@Controller('auth')
export class AuthController {
  constructor(@Inject(TOKENS.auth) private readonly auth: AuthService) {}

  @Public() @Post('code') request(@Body() b: unknown) { const x = parse(RequestBody, b); return run(() => this.auth.requestCode(x.phone, x.role)); }
  @Public() @Post('verify') verify(@Body() b: unknown) { const x = parse(VerifyBody, b); return run(() => this.auth.verifyCode(x.phone, x.role, x.code, { name: x.name, email: x.email })); }
  @Public() @Post('refresh') refresh(@Body() b: unknown) { return run(() => this.auth.refresh(parse(RefreshBody, b).refreshToken)); }
  @Public() @Post('sign-out') signOut(@Body() b: unknown) { return run(() => this.auth.signOut(parse(RefreshBody, b).refreshToken)); }
  @Get('me') me(@CurrentUser() u: AuthUser) { return this.auth.me(u.id); }
  @Patch('me') updateMe(@CurrentUser() u: AuthUser, @Body() b: unknown) { return run(() => this.auth.updateMe(u.id, parse(MeBody, b))); }
}
