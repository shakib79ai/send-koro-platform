import { Logger } from '@nestjs/common';

export interface SmsSender { send(to: string, body: string): Promise<void> }

/** Development only: prints the message to the server log. Refused in production by env validation. */
export class ConsoleSms implements SmsSender {
  private readonly log = new Logger('SMS');
  readonly sent: { to: string; body: string }[] = [];
  async send(to: string, body: string) { this.sent.push({ to, body }); this.log.log(`→ ${to}: ${body}`); }
}

export class TwilioSms implements SmsSender {
  constructor(private readonly sid: string, private readonly token: string, private readonly from: string) {}
  async send(to: string, body: string) {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.sid}/Messages.json`, {
      method: 'POST',
      headers: { authorization: 'Basic ' + Buffer.from(`${this.sid}:${this.token}`).toString('base64'), 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: this.from, Body: body }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Twilio ${res.status}`);
  }
}
