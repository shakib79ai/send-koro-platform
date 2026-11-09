/** Server-Sent Events for live screens. EventSource can't send headers, so pass ?access_token=. */
import { Controller, Inject, MessageEvent, Param, Sse } from '@nestjs/common';
import { from, interval, map, merge, mergeMap, Observable } from 'rxjs';
import { TOKENS } from '../common/tokens';
import { AuthUser, CurrentUser, Roles } from '../auth/auth.guard';
import { EventBus } from './events';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { OrderStateService } from '../orders/order-state.service';
import { DriversService } from '../drivers/drivers.service';
import { toHttp } from '../common/http';

const keepAlive = () => interval(25_000).pipe(map(() => ({ type: 'ping', data: {} }) as MessageEvent));

@Controller('live')
export class RealtimeController {
  constructor(
    @Inject(TOKENS.events) private readonly events: EventBus,
    @Inject(TOKENS.restaurants) private readonly restaurants: RestaurantsService,
    @Inject(TOKENS.orderState) private readonly state: OrderStateService,
    @Inject(TOKENS.drivers) private readonly drivers: DriversService,
  ) {}

  private guarded(check: () => Promise<unknown>, channel: string): Observable<MessageEvent> {
    return from(check().catch((e) => { throw toHttp(e); })).pipe(mergeMap(() => merge(this.events.stream([channel]) as Observable<MessageEvent>, keepAlive())));
  }

  @Roles('restaurant_staff', 'admin') @Sse('restaurants/:id')
  restaurant(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.guarded(() => this.restaurants.requireMember(u, id), `restaurant:${id}`); }

  @Roles('customer') @Sse('orders/:id')
  order(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.guarded(async () => { const o = await this.state.load(id); if (o.customerId !== u.id) throw new Error('not yours'); }, `order:${id}`);
  }

  @Roles('driver') @Sse('driver')
  driver(@CurrentUser() u: AuthUser): Observable<MessageEvent> {
    return from(this.drivers.me(u)).pipe(mergeMap((d) => merge(this.events.stream([`driver:${d?.id ?? 'none'}`]) as Observable<MessageEvent>, keepAlive())));
  }

  @Roles('admin') @Sse('admin')
  admin() { return merge(this.events.stream(['admin']) as Observable<MessageEvent>, keepAlive()); }
}
