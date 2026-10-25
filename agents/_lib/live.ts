// Why: the studio shows a run while it happens only if the runner tells it as it goes. The ledger hands each
// event here the moment it is recorded, and this sends it on to the studio (POST /api/runs/<run>/events),
// in order, one send at a time, never holding the run up. The ledger file stays the record: a send that
// fails is tried again with the next event, the studio's own check refuses anything out of order, and at
// the end the run waits a few seconds at most for the last send, then carries on regardless. With no studio
// address set (STUDIO_URL), nothing is sent at all. From GitHub Actions or a computer outside Cloudflare
// Access, an Access service token (STUDIO_ACCESS_CLIENT_ID and STUDIO_ACCESS_CLIENT_SECRET) lets it in.
import type { LedgerEvent } from '@roadbook/core';

/** The studio's limit on events per send. */
const BATCH = 200;
const SEND_TIMEOUT_MS = 10_000;
const FLUSH_TIMEOUT_MS = 5_000;

export interface LiveOptions {
  url?: string | undefined;
  clientId?: string | undefined;
  clientSecret?: string | undefined;
  fetch?: typeof fetch;
  warn?: (message: string) => void;
}

export class LiveReporter {
  readonly #endpoint: string | null;
  readonly #thought: string;
  readonly #headers: Record<string, string>;
  readonly #fetch: typeof fetch;
  readonly #warn: (message: string) => void;
  /** Every event heard, and how many of them the studio has said it keeps. */
  readonly #events: LedgerEvent[] = [];
  #kept = 0;
  #chain: Promise<void> = Promise.resolve();
  #warned = false;

  constructor(run: string, thought: string, options: LiveOptions = {}) {
    const base = options.url?.replace(/\/+$/, '');
    this.#endpoint = base ? `${base}/api/runs/${run}/events` : null;
    this.#thought = thought;
    this.#headers = {
      'content-type': 'application/json',
      ...(options.clientId && options.clientSecret
        ? {
            'CF-Access-Client-Id': options.clientId,
            'CF-Access-Client-Secret': options.clientSecret,
          }
        : {}),
    };
    this.#fetch = options.fetch ?? fetch;
    this.#warn =
      options.warn ??
      ((message) => {
        console.warn(message);
      });
  }

  /** True when there is a studio to tell. */
  get on(): boolean {
    return this.#endpoint !== null;
  }

  /** How many events the studio has said it keeps. */
  get kept(): number {
    return this.#kept;
  }

  /** The ledger's listener: note the event and send what the studio has not got yet. Never throws. */
  readonly hear = (event: LedgerEvent): void => {
    if (this.#endpoint === null) return;
    this.#events.push(event);
    this.#chain = this.#chain.then(() => this.#send());
  };

  /** Waits for the last send, but never longer than a few seconds: the run's end does not wait on the studio. */
  async flush(timeoutMs = FLUSH_TIMEOUT_MS): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
      this.#chain,
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      }),
    ]);
    clearTimeout(timer);
  }

  async #send(): Promise<void> {
    if (this.#endpoint === null || this.#kept >= this.#events.length) return;
    const events = this.#events.slice(this.#kept, this.#kept + BATCH);
    try {
      const response = await this.#fetch(this.#endpoint, {
        method: 'POST',
        headers: this.#headers,
        body: JSON.stringify({ thought: this.#thought, events }),
        signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
      });
      const data: unknown = await response.json().catch(() => null);
      const kept =
        typeof data === 'object' && data !== null ? (data as { kept?: unknown }).kept : null;
      if (response.ok && typeof kept === 'number') {
        this.#kept = kept;
        if (this.#kept < this.#events.length) await this.#send();
        return;
      }
      // Out of step with what the studio keeps (a send lost on the way back): start again from the first
      // event; the studio accepts what it already has and keeps the rest.
      if (response.status === 409) this.#kept = 0;
      this.#warnOnce(`the studio answered ${String(response.status)}`);
    } catch (error: unknown) {
      this.#warnOnce(error instanceof Error ? error.message : String(error));
    }
  }

  #warnOnce(reason: string): void {
    if (this.#warned) return;
    this.#warned = true;
    this.#warn(
      `The studio did not hear this run live (${reason}). It keeps trying; the ledger file has every event.`,
    );
  }
}

/** The reporter for a run, from the environment: off unless STUDIO_URL is set. */
export function liveFromEnv(
  run: string,
  thought: string,
  env: Record<string, string | undefined>,
): LiveReporter {
  return new LiveReporter(run, thought, {
    url: env['STUDIO_URL'],
    clientId: env['STUDIO_ACCESS_CLIENT_ID'],
    clientSecret: env['STUDIO_ACCESS_CLIENT_SECRET'],
  });
}
