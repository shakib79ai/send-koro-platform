/** Fan-out to live screens (SSE) and phones (push). Customer-facing text never names the courier company. */
import { inArray } from 'drizzle-orm';
import type { Db } from '../db/client';
import { deviceTokens } from '../db/schema';
import type { EventBus } from '../realtime/events';
import type { PushMessage, PushSender } from '../integrations/push';

export class NotificationsService {
  constructor(private readonly db: Db, private readonly events: EventBus, private readonly push: PushSender) {}

  live(channel: string, type: string, data: unknown) { this.events.publish(channel, type, data); }

  async pushTo(userIds: string[], msg: PushMessage) {
    if (!userIds.length) return;
    const rows = await this.db.select({ token: deviceTokens.token }).from(deviceTokens).where(inArray(deviceTokens.userId, userIds));
    await this.push.send(rows.map((r) => r.token), msg).catch(() => undefined); // push is best-effort
  }
}
