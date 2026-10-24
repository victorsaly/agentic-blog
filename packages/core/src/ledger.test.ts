// Why: the ledger is the proof. These tests show that it refuses outputs without a why and overrides
// without a reason, that any change to a past event is detected, and that the disclosure never claims
// more human work than was recorded.
import { describe, expect, it } from 'vitest';
import { Ledger, LedgerError, costs, disclosure, type Receipt } from './ledger.js';

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
