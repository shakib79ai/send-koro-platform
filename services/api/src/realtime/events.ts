/**
 * In-process event bus feeding Server-Sent Events. Channels:
 *   restaurant:<id>  live orders board     order:<id>  customer tracking
 *   driver:<id>      offers and trip       admin       operations
 * For more than one API instance, back this with Postgres LISTEN/NOTIFY or Redis pub/sub.
 */
import { Subject, filter, map, Observable } from 'rxjs';

export interface AppEvent { channel: string; type: string; data: unknown }

export class EventBus {
  private readonly subject = new Subject<AppEvent>();
  readonly published: AppEvent[] = [];
  publish(channel: string, type: string, data: unknown) {
    const e = { channel, type, data };
    this.published.push(e);
    if (this.published.length > 500) this.published.shift();
    this.subject.next(e);
  }
  stream(channels: string[]): Observable<{ type: string; data: unknown }> {
    const set = new Set(channels);
    return this.subject.pipe(filter((e) => set.has(e.channel)), map((e) => ({ type: e.type, data: e.data })));
  }
}
