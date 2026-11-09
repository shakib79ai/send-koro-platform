/**
 * Delivery status webhooks from Uber Direct and DoorDash Drive.
 *  • Uber Direct signs the raw body with HMAC-SHA256 (header x-uber-signature, older x-postmates-signature).
 *  • DoorDash Drive sends the Authorization header value you configure in its portal.
 */
import { BadRequestException, Controller, HttpCode, Inject, Post, Req, UnauthorizedException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { Public } from '../auth/auth.guard';
import { TOKENS } from '../common/tokens';
import { DispatchService } from './dispatch.service';

type Status = Parameters<DispatchService['providerUpdate']>[2];

const UBER: Record<string, Status> = { pickup: 'assigned', pickup_complete: 'picked_up', dropoff: 'at_dropoff', delivered: 'delivered', canceled: 'cancelled', returned: 'failed' };
const DOORDASH: Record<string, Status> = {
  DASHER_CONFIRMED: 'assigned', DASHER_CONFIRMED_PICKUP_ARRIVAL: 'at_pickup', DASHER_PICKED_UP: 'picked_up',
  DASHER_CONFIRMED_DROPOFF_ARRIVAL: 'at_dropoff', DASHER_DROPPED_OFF: 'delivered', DELIVERY_CANCELLED: 'cancelled', DELIVERY_RETURNED: 'failed',
};

const safeEqual = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

@Public()
@Controller('webhooks')
export class ProviderWebhooksController {
  constructor(@Inject(TOKENS.dispatch) private readonly dispatch: DispatchService) {}

  @Post('uber-direct') @HttpCode(200)
  async uber(@Req() req: Request & { rawBody?: Buffer }) {
    const secret = process.env.UBER_DIRECT_WEBHOOK_SECRET;
    if (!secret) throw new UnauthorizedException('Uber Direct webhook secret not configured');
    const sig = String(req.headers['x-uber-signature'] ?? req.headers['x-postmates-signature'] ?? '');
    const expected = createHmac('sha256', secret).update(req.rawBody ?? Buffer.alloc(0)).digest('hex');
    if (!sig || !safeEqual(sig, expected)) throw new UnauthorizedException('Bad signature');
    const body = req.body as { kind?: string; status?: string; delivery_id?: string; data?: { id?: string; status?: string; tracking_url?: string } };
    const id = body.delivery_id ?? body.data?.id;
    const status = UBER[body.status ?? body.data?.status ?? ''];
    if (!id) throw new BadRequestException('missing delivery id');
    if (status) await this.dispatch.providerUpdate('uber_direct', id, status, body.data?.tracking_url);
    return { received: true };
  }

  @Post('doordash') @HttpCode(200)
  async doordash(@Req() req: Request) {
    const secret = process.env.DOORDASH_WEBHOOK_SECRET;
    if (!secret) throw new UnauthorizedException('DoorDash webhook secret not configured');
    if (!safeEqual(String(req.headers.authorization ?? ''), secret)) throw new UnauthorizedException('Bad credentials');
    const body = req.body as { event_name?: string; external_delivery_id?: string; tracking_url?: string };
    if (!body.external_delivery_id) throw new BadRequestException('missing external_delivery_id');
    const status = DOORDASH[body.event_name ?? ''];
    if (status) await this.dispatch.providerUpdate('doordash_drive', body.external_delivery_id, status, body.tracking_url);
    return { received: true };
  }
}
