import { Logger } from '@nestjs/common';

export interface PushMessage { title: string; body: string; data?: Record<string, string> }
export interface PushSender { send(tokens: string[], msg: PushMessage): Promise<void> }

/** Logs pushes. Swap for FCM (Android, iOS via APNs key in Firebase, and web push) when keys exist. */
export class ConsolePush implements PushSender {
  private readonly log = new Logger('Push');
  readonly sent: { tokens: string[]; msg: PushMessage }[] = [];
  async send(tokens: string[], msg: PushMessage) { if (!tokens.length) return; this.sent.push({ tokens, msg }); this.log.log(`${tokens.length} device(s): ${msg.title} — ${msg.body}`); }
}
