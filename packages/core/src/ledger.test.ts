// Why: the ledger is the proof. These tests show that it refuses outputs without a why and overrides
// without a reason, that any change to a past event is detected, and that the disclosure never claims
// more human work than was recorded.
import { describe, expect, it } from 'vitest';
import {
  Ledger,
  LedgerError,
  costs,
  disclosure,
  eventLines,
  readEvents,
  readHead,
  type Receipt,
} from './ledger.js';

const fixedClock = (): (() => Date) => {
  let t = Date.parse('2026-10-24T09:00:00Z');
  return () => new Date((t += 1000));
};

const receipt = (agent: string): Receipt => ({
  origin: 'thoughts/2026-10-24-test/origin/transcript.md',
  inputsHash: 'a'.repeat(64),
  agent,
  cardVersion: '1.0.0',
  promptHash: 'b'.repeat(64),
  provider: 'writer',
  model: 'test-model',
  at: '2026-10-24T09:00:00Z',
  usd: 0.02,
});

async function sampleRun(): Promise<Ledger> {
  const ledger = new Ledger({ now: fixedClock() });
  await ledger.append({ type: 'run.started', workflow: 'post', origin: 'o', by: 'owner' });
  await ledger.append({ type: 'node.state', node: 'write', from: 'waiting', to: 'running' });
  await ledger.append({
    type: 'cost.incurred',
    node: 'write',
    provider: 'writer',
    usd: 0.02,
    units: '1.2k tokens',
  });
  await ledger.append({
    type: 'node.output',
    node: 'write',
    why: 'The origin tidied into a draft a stranger can follow, nothing added.',
    receipt: receipt('write'),
    ref: 'versions/long.md',
    authoredBy: 'agent',
  });
  return ledger;
}

describe('Ledger', () => {
  it('chains every event to the one before', async () => {
    const ledger = await sampleRun();
    expect(ledger.events.map((e) => e.seq)).toEqual([0, 1, 2, 3]);
    expect(ledger.events[1]?.prev).toBe(ledger.events[0]?.hash);
    expect(await Ledger.verify(ledger.events)).toBeNull();
  });

  it('detects an edited past event', async () => {
    const ledger = await sampleRun();
    const tampered = ledger.events.map((e) =>
      e.seq === 2 && e.type === 'cost.incurred' ? { ...e, usd: 0 } : e,
    );
    expect(await Ledger.verify(tampered)).toBe(2);
  });

  it('detects a removed event', async () => {
    const ledger = await sampleRun();
    expect(await Ledger.verify(ledger.events.filter((e) => e.seq !== 1))).toBe(1);
  });

  it('refuses an output without a why', async () => {
    const ledger = new Ledger();
    await expect(
      ledger.append({
        type: 'node.output',
        node: 'write',
        why: 'ok',
        receipt: receipt('write'),
        ref: 'x',
        authoredBy: 'agent',
      }),
    ).rejects.toBeInstanceOf(LedgerError);
  });

  it('refuses an override without a reason', async () => {
    const ledger = new Ledger();
    await expect(
      ledger.append({ type: 'override.given', node: 'safety', reason: '', by: 'owner' }),
    ).rejects.toThrow(/needs a reason/);
  });

  it('only corrects, never rewrites: a correction must point backwards', async () => {
    const ledger = await sampleRun();
    await expect(
      ledger.append({ type: 'correction', of: 99, reason: 'wrong cost', by: 'owner' }),
    ).rejects.toThrow();
    const fixed = await ledger.append({
      type: 'correction',
      of: 2,
      reason: 'the cost was counted twice',
      by: 'owner',
    });
    expect(fixed.seq).toBe(4);
    expect(ledger.events[2]?.type).toBe('cost.incurred');
  });
});

describe('readings', () => {
  it('adds up costs by node and by provider', async () => {
    const ledger = await sampleRun();
    await ledger.append({
      type: 'cost.incurred',
      node: 'image',
      provider: 'images',
      usd: 0.04,
      units: '1 image',
    });
    const c = costs(ledger.events);
    expect(c.totalUsd).toBeCloseTo(0.06);
    expect(c.byNode).toEqual({ write: 0.02, image: 0.04 });
    expect(c.byProvider).toEqual({ writer: 0.02, images: 0.04 });
  });

  it('counts an output as edited by a person only when an edit was recorded', async () => {
    const ledger = await sampleRun();
    expect(disclosure(ledger.events).byAgent).toEqual(['write']);
    await ledger.append({
      type: 'feedback.given',
      node: 'write',
      kind: 'edit',
      words: 'changed the opening',
      by: 'owner',
    });
    const d = disclosure(ledger.events);
    expect(d.byAgent).toEqual([]);
    expect(d.editedByPerson).toEqual(['write']);
  });

  it('lists every override with its reason', async () => {
    const ledger = await sampleRun();
    await ledger.append({
      type: 'override.given',
      node: 'safety',
      reason: 'the quote is the author’s own',
      by: 'owner',
    });
    expect(disclosure(ledger.events).overrides).toEqual([
      { node: 'safety', reason: 'the quote is the author’s own', by: 'owner' },
    ]);
  });
});

describe('review fixes', () => {
  const output = (node: string) =>
    ({
      type: 'node.output',
      node,
      why: 'A draft a stranger can follow, written from the origin only.',
      receipt: receipt(node),
      ref: `versions/${node}.md`,
      authoredBy: 'agent',
    }) as const;

  it('keeps the chain whole when appends run at the same time', async () => {
    const ledger = new Ledger({ now: fixedClock() });
    await Promise.all([
      ledger.append({ type: 'hold.raised', node: 'safety', reason: 'a' }),
      ledger.append({ type: 'hold.raised', node: 'security', reason: 'b' }),
      ledger.append({ type: 'hold.raised', node: 'seo', reason: 'c' }),
    ]);
    expect(ledger.events.map((e) => e.seq)).toEqual([0, 1, 2]);
    expect(await Ledger.verify(ledger.events)).toBeNull();
  });

  it('cannot be rewritten through what it hands out or what it was given', async () => {
    const ledger = new Ledger({ now: fixedClock() });
    const given = output('write');
    const mutableReceipt = { ...given.receipt };
    const written = await ledger.append({ ...given, receipt: mutableReceipt });
    mutableReceipt.usd = 99;
    (written as { ref: string }).ref = 'elsewhere';
    (ledger.events[0] as { ref: string }).ref = 'elsewhere';
    const [kept] = ledger.events;
    expect(kept?.type === 'node.output' && kept.receipt.usd).toBe(0.02);
    expect(kept?.type === 'node.output' && kept.ref).toBe('versions/write.md');
    expect(await Ledger.verify(ledger.events)).toBeNull();
  });

  it('finds a removed end when given the head kept from the run', async () => {
    const ledger = await sampleRun();
    const head = ledger.head;
    const cut = ledger.events.slice(0, -1);
    expect(await Ledger.verify(cut)).toBeNull(); // the chain alone cannot tell
    expect(await Ledger.verify(cut, head)).toBe(cut.length);
    expect(await Ledger.verify(ledger.events, head)).toBeNull();
  });

  it('does not carry an edit over to a newer output of the same node', async () => {
    const ledger = new Ledger({ now: fixedClock() });
    await ledger.append(output('convert'));
    await ledger.append({
      type: 'feedback.given',
      node: 'convert',
      kind: 'edit',
      words: 'x',
      by: 'owner',
    });
    await ledger.append(output('convert'));
    const d = disclosure(ledger.events);
    expect(d.byAgent).toEqual(['convert']);
    expect(d.editedByPerson).toEqual([]);
  });
});

describe('a ledger kept on disk', () => {
  it('reads back what it wrote and carries on the same chain', async () => {
    const first = await sampleRun();
    const events = readEvents(eventLines(first.events));
    const head = readHead(JSON.stringify(first.head));
    const resumed = await Ledger.resume(events, head, { now: fixedClock() });
    await resumed.append({ type: 'node.state', node: 'write', from: 'done', to: 'running' });
    expect(resumed.events).toHaveLength(first.events.length + 1);
    expect(await Ledger.verify(resumed.events, resumed.head)).toBeNull();
  });

  it('refuses to carry on a ledger whose past was edited', async () => {
    const first = await sampleRun();
    const lines = eventLines(first.events).split('\n');
    lines[1] = (lines[1] ?? '').replace('"to":"running"', '"to":"done"');
    const edited = readEvents(lines.join('\n'));
    await expect(Ledger.resume(edited, first.head)).rejects.toThrow(LedgerError);
  });

  it('refuses a ledger whose last events were cut off', async () => {
    const first = await sampleRun();
    await expect(Ledger.resume(first.events.slice(0, -1), first.head)).rejects.toThrow(
      /does not verify/,
    );
  });

  it('names the line that is not an event', () => {
    expect(() => readEvents('{"type":"run.started"}\n')).toThrow('line 1 is not a ledger event');
    expect(() => readEvents('\nnot json')).toThrow('line 2 is not JSON');
    expect(() => readHead('{"count":-1,"hash":"x"}')).toThrow(LedgerError);
  });
});
