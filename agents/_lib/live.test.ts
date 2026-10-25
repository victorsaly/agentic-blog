// Why: telling the studio must never cost a run anything: not an event out of order, not a crash, not a run
// held up by a studio that does not answer. These show that, with a pretend studio.
import { describe, expect, it } from 'vitest';
import { Ledger, type LedgerEvent } from '@roadbook/core';
import { LiveReporter, liveFromEnv } from './live.js';

const RUN = '20261025T071128Z-seo-ab12';
const THOUGHT = '2026-10-23-a';

/** A studio that keeps what it is sent, in order, like the real one; it can be told to fail. */
function studio() {
  const kept: LedgerEvent[] = [];
  const calls: { url: string; headers: Record<string, string> }[] = [];
  let failing = 0;
  const fake = ((url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string> });
    if (failing > 0) {
      failing -= 1;
      return Promise.resolve(new Response(JSON.stringify({ error: 'down' }), { status: 503 }));
    }
    const { events } = JSON.parse(init.body as string) as { events: LedgerEvent[] };
    for (const e of events) if (e.seq === kept.length) kept.push(e);
    return Promise.resolve(new Response(JSON.stringify({ kept: kept.length }), { status: 200 }));
  }) as unknown as typeof fetch;
  return {
    fake,
    kept,
    calls,
    fail: (times: number) => {
      failing = times;
    },
  };
}

async function record(live: LiveReporter, n: number): Promise<Ledger> {
  const ledger = new Ledger({ onAppend: live.hear });
  await ledger.append({ type: 'run.started', workflow: 'blog-post', origin: 'o', by: 'owner' });
  for (let i = 1; i < n; i += 1)
    await ledger.append({ type: 'node.state', node: 'seo', from: 'idle', to: 'running' });
  return ledger;
}

describe('LiveReporter', () => {
  it('sends every event in order to the run, with the Access service token', async () => {
    const s = studio();
    const live = new LiveReporter(RUN, THOUGHT, {
      url: 'https://blog.example/',
      clientId: 'id',
      clientSecret: 'secret',
      fetch: s.fake,
    });
    const ledger = await record(live, 3);
    await live.flush();
    expect(s.kept).toEqual(ledger.events);
    expect(s.calls[0]?.url).toBe(`https://blog.example/api/runs/${RUN}/events`);
    expect(s.calls[0]?.headers['CF-Access-Client-Id']).toBe('id');
  });

  it('catches up after the studio was down, and says so once', async () => {
    const s = studio();
    const warnings: string[] = [];
    const live = new LiveReporter(RUN, THOUGHT, {
      url: 'https://blog.example',
      fetch: s.fake,
      warn: (m) => warnings.push(m),
    });
    s.fail(2);
    const ledger = await record(live, 4);
    await live.flush();
    expect(s.kept).toEqual(ledger.events);
    expect(warnings).toHaveLength(1);
  });

  it('never stops a run when the studio cannot be reached at all', async () => {
    const live = new LiveReporter(RUN, THOUGHT, {
      url: 'https://blog.example',
      fetch: (() => Promise.reject(new Error('offline'))) as unknown as typeof fetch,
      warn: () => undefined,
    });
    const ledger = await record(live, 2);
    await live.flush(50);
    expect(ledger.head.count).toBe(2);
    expect(live.kept).toBe(0);
  });

  it('sends nothing when no studio is set', async () => {
    const live = liveFromEnv(RUN, THOUGHT, {});
    expect(live.on).toBe(false);
    const ledger = await record(live, 2);
    await live.flush();
    expect(ledger.head.count).toBe(2);
  });
});
