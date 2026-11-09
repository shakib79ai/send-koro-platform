import { BadRequestException, Controller, Headers, HttpCode, Inject, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { TOKENS } from '../tokens';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks/stripe')
export class WebhooksController {
  constructor(@Inject(TOKENS.webhooks) private readonly webhooks: WebhooksService) {}

  private raw(req: RawBodyRequest<Request>) {
    if (!req.rawBody) throw new BadRequestException('Raw body missing (NestFactory must be created with rawBody: true)');
    return req.rawBody;
  }

  @Post() @HttpCode(200)
  async platform(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') sig?: string) {
    let event;
    try { event = this.webhooks.verify('platform', this.raw(req), sig); } catch (e) { throw new BadRequestException((e as Error).message); }
    return { received: true, processed: await this.webhooks.handle(event) };
  }

  @Post('connect') @HttpCode(200)
  async connect(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') sig?: string) {
    let event;
    try { event = this.webhooks.verify('connect', this.raw(req), sig); } catch (e) { throw new BadRequestException((e as Error).message); }
    return { received: true, processed: await this.webhooks.handle(event) };
  }

  @Post('v2') @HttpCode(200)
  async thin(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') sig?: string) {
    try { return { received: true, processed: await this.webhooks.handleThin(this.raw(req), sig) }; }
    catch (e) { throw new BadRequestException((e as Error).message); }
  }
}
