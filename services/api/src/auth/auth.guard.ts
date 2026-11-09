import { CanActivate, ExecutionContext, Inject, Injectable, SetMetadata, UnauthorizedException, ForbiddenException, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { TOKENS } from '../common/tokens';

export type Role = 'customer' | 'restaurant_staff' | 'driver' | 'admin';
export interface AuthUser { id: string; role: Role; phone: string }

export const ROLES_KEY = 'roles';
export const PUBLIC_KEY = 'public';
/** Roles allowed on a controller or handler. Without it, any signed-in user may call. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
export const Public = () => SetMetadata(PUBLIC_KEY, true);
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user);

/** Global guard: Bearer access token (or ?access_token= for EventSource streams). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(TOKENS.jwt) private readonly jwt: JwtService, @Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const targets = [ctx.getHandler(), ctx.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, targets)) return true;
    const req = ctx.switchToHttp().getRequest();
    const header = String(req.headers.authorization ?? '');
    const token = header.startsWith('Bearer ') ? header.slice(7) : typeof req.query?.access_token === 'string' ? req.query.access_token : '';
    if (!token) throw new UnauthorizedException({ code: 'unauthenticated', message: 'Sign in required' });
    let payload: { sub: string; role: Role; phone: string; typ?: string };
    try { payload = this.jwt.verify(token); } catch { throw new UnauthorizedException({ code: 'token_invalid', message: 'Session expired' }); }
    if (payload.typ !== 'access') throw new UnauthorizedException({ code: 'token_invalid', message: 'Wrong token type' });
    req.user = { id: payload.sub, role: payload.role, phone: payload.phone } satisfies AuthUser;
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, targets);
    if (roles?.length && !roles.includes(payload.role)) throw new ForbiddenException({ code: 'forbidden', message: 'Not allowed for this account type' });
    return true;
  }
}
