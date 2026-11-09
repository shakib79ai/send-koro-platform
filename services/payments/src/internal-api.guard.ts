import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';

/** Replace with your real service auth (JWT/mTLS). Requires header `x-internal-key: $INTERNAL_API_KEY`. */
@Injectable()
export class InternalApiGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const expected = process.env.INTERNAL_API_KEY;
    if (!expected) throw new UnauthorizedException('INTERNAL_API_KEY not configured');
    const got = String(ctx.switchToHttp().getRequest().headers['x-internal-key'] ?? '');
    const a = Buffer.from(got), b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw new UnauthorizedException();
    return true;
  }
}
