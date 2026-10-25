// Why: the live copy of a run must never hold an event the ledger would not; a missed check here would let
// the studio show work that never happened, or lose the order of what did.
import { describe, expect, it } from 'vitest';
import { Ledger } from '@roadbook/core';
import {
  GENESIS,
  agentOfRun,
  checkAppend,
  isRunId,
  readAppendRequest,
  summarise,
} from './live-runs.js';

const ID = '20261025T071128Z-safety-d367';

async function aRun() {
  let t = Date.parse('2026-10-25T07:11:28Z');
  const ledger = new Ledger({ now: () => new Date((t += 1000)) });
  await ledger.append({ type: 'run.started', workflow: 'blog-post', origin: 'o', by: 'owner' });
  await ledger.append({ type: 'node.state', node: 'safety', from: 'idle', to: 'running' });
  await ledger.append({
    type: 'cost.incurred',
    node: 'safety',
    provider: 'claude',
    usd: 0.012,
    units: '1k tokens',
  });
  await ledger.append({
    type: 'node.state',
    node: 'safety',
    from: 'running',
    to: 'held',
    reason: 'r',
  });
  return ledger.events;
}

describe('run ids', () => {
  it('knows a run id and the agent in it', () => {
    expect(isRunId(ID)).toBe(true);
    expect(isRunId('../etc/passwd')).toBe(false);
    expect(agentOfRun(ID)).toBe('safety');
  });
});

describe('readAppendRequest', () => {
  it('takes a thought and events, and refuses anything else', async () => {
    const events = await aRun();
    expect(readAppendRequest({ thought: '2026-10-23-a', events }).ok).toBe(true);
    expect(readAppendRequest({ thought: 'nope', events }).ok).toBe(false);
    expect(readAppendRequest({ thought: '2026-10-23-a', events: [] }).ok).toBe(false);
    expect(readAppendRequest({ thought: '2026-10-23-a', events: [{ type: 'x' }] }).ok).toBe(false);
  });
});

describe('checkAppend', () => {
  it('keeps a run sent from the start, and then its next events', async () => {
    const events = await aRun();
    const first = await checkAppend({ count: 0, hash: GENESIS }, new Map(), events.slice(0, 2));
    expect(first).toMatchObject({ ok: true, head: { count: 2 } });
    if (!first.ok) return;
    const rest = await checkAppend(first.head, new Map(), events.slice(2));
    expect(rest).toMatchObject({ ok: true, head: { count: 4, hash: events[3]?.hash } });
  });

  it('accepts a resend of what it already has and keeps only what is new', async () => {
    const events = await aRun();
    const kept = { count: 2, hash: events[1]?.hash ?? '' };
    const known = new Map(events.slice(0, 2).map((e) => [e.seq, e.hash]));
    const result = await checkAppend(kept, known, events);
    expect(result.ok && result.fresh.map((e) => e.seq)).toEqual([2, 3]);
  });

  it('refuses a gap, a changed event, and one that does not follow the chain', async () => {
    const events = await aRun();
    expect(
      await checkAppend({ count: 0, hash: GENESIS }, new Map(), events.slice(1)),
    ).toMatchObject({
      ok: false,
      status: 409,
    });
    const changed = events.map((e) => (e.seq === 2 ? { ...e, usd: 0 } : e));
    expect(await checkAppend({ count: 0, hash: GENESIS }, new Map(), changed)).toMatchObject({
      ok: false,
      status: 422,
    });
    const forgedResend = await checkAppend(
      { count: 4, hash: events[3]?.hash ?? '' },
      new Map(events.map((e) => [e.seq, e.hash])),
      changed,
    );
    expect(forgedResend).toMatchObject({ ok: false, status: 422 });
    const known = new Map([[0, 'f'.repeat(64)]]);
    expect(await checkAppend({ count: 1, hash: 'f'.repeat(64) }, known, events)).toMatchObject({
      ok: false,
      status: 409,
    });
  });
});

describe('summarise', () => {
  it('follows the state, adds up the cost, and keeps when it started', async () => {
    const events = await aRun();
    const head = { count: 4, hash: events[3]?.hash ?? '' };
    const row = summarise(null, ID, '2026-10-23-a', events, head);
    expect(row).toMatchObject({
      agent: 'safety',
      state: 'held',
      usd: 0.012,
      events: 4,
      startedAt: events[0]?.at,
      updatedAt: events[3]?.at,
    });
    const later = summarise({ ...row, state: 'running' }, ID, '2026-10-23-a', [], head);
    expect(later.startedAt).toBe(row.startedAt);
  });
});
