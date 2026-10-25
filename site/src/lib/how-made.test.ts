// Why: this is what a reader is told about how a post was made; it must come from the ledger alone, never
// publish a guard's reason, and never show an unknown cost as free.
import { describe, expect, it } from 'vitest';
import { Ledger, type EventBody, type Receipt } from '@roadbook/core';
import { howMade, moneyOf, runRows, spendIn } from './how-made.js';

const receipt = (agent: string): Receipt => ({
  origin: 'thoughts/t/origin/text.md',
  inputsHash: 'a'.repeat(64),
  agent,
  cardVersion: '1.0.0',
  promptHash: 'b'.repeat(64),
  provider: 'writer',
  model: 'm',
  at: '2026-10-25T07:00:00Z',
  usd: 0,
});

async function run(
  id: string,
  bodies: EventBody[],
): Promise<{ id: string; events: Ledger['events'] }> {
  let t = Date.parse(`${id.slice(0, 10)}T07:00:00Z`);
  const ledger = new Ledger({ now: () => new Date((t += 1000)) });
  for (const body of bodies) await ledger.append(body);
  return { id, events: ledger.events };
}

const started: EventBody = { type: 'run.started', workflow: 'blog-post', origin: 'o', by: 'local' };
const state = (node: string, from: string, to: string, reason?: string): EventBody =>
  ({ type: 'node.state', node, from, to, ...(reason ? { reason } : {}) }) as EventBody;
const output = (node: string): EventBody => ({
  type: 'node.output',
  node,
  why: 'A file this agent wrote, with a why long enough.',
  receipt: receipt(node),
  ref: `thoughts/t/${node}.md`,
  authoredBy: 'agent',
});
const cost = (node: string, usd: number): EventBody => ({
  type: 'cost.incurred',
  node,
  provider: 'writer',
  usd,
  units: 'm: 1 input token',
});

describe('howMade', () => {
  it('draws nothing for a post with no recorded runs', () => {
    expect(howMade([])).toBeNull();
  });

  it("keeps each agent's latest run, adds up every run's cost, and never passes on a hold reason", async () => {
    const made = howMade([
      await run('2026-10-24-a', [
        started,
        state('safety', 'idle', 'running'),
        cost('safety', 0.01),
        output('safety'),
        state('safety', 'running', 'done'),
      ]),
      await run('2026-10-25-b', [
        started,
        state('safety', 'done', 'running'),
        cost('safety', 0.02),
        output('safety'),
        state('safety', 'running', 'done'),
      ]),
      await run('2026-10-25-c', [
        started,
        state('security', 'idle', 'running'),
        cost('security', 0.05),
        output('security'),
        state('security', 'running', 'held', 'names a private person: Jane Doe'),
      ]),
    ]);
    expect(made?.steps).toEqual([
      { agent: 'safety', on: '2026-10-25', ended: 'done', usd: 0.02, costed: true, runs: 2 },
      { agent: 'security', on: '2026-10-25', ended: 'held', usd: 0.05, costed: true, runs: 1 },
    ]);
    expect(made?.totalUsd).toBe(0.08);
    expect(made?.totalIsFloor).toBe(false);
    expect(made?.since).toBe('2026-10-24');
    expect(JSON.stringify(made)).not.toContain('Jane Doe');
  });

  it('marks a run that made something without a recorded cost, and treats a run held before any call as free', async () => {
    const made = howMade([
      await run('2026-10-25-v', [
        started,
        state('voice', 'idle', 'running'),
        output('voice'),
        state('voice', 'running', 'done'),
      ]),
      await run('2026-10-25-w', [
        started,
        state('seo', 'idle', 'running'),
        state('seo', 'running', 'held', 'guards not passed'),
      ]),
    ]);
    expect(made?.steps.map((s) => [s.agent, s.costed])).toEqual([
      ['voice', false],
      ['seo', true],
    ]);
    expect(made?.totalIsFloor).toBe(true);
  });
});

describe('moneyOf', () => {
  it('says cents below a dollar and dollars above', () => {
    expect(moneyOf(0.049224)).toBe('4.9¢');
    expect(moneyOf(0.12)).toBe('12¢');
    expect(moneyOf(0.0003)).toBe('<0.1¢');
    expect(moneyOf(0)).toBe('0.0¢');
    expect(moneyOf(1.2)).toBe('$1.20');
  });

  it('shows pounds and pence at the given rate, from the dollars recorded', () => {
    const gbp = { show: 'GBP' as const, perUsd: 0.748 };
    expect(moneyOf(0.049224, gbp)).toBe('3.7p');
    expect(moneyOf(0.074, gbp)).toBe('5.5p');
    expect(moneyOf(2, gbp)).toBe('£1.50');
  });
});

describe('runRows and spendIn', () => {
  it('lists every run newest first, held ones included, and adds up a month', async () => {
    const rows = runRows([
      await run('2026-09-30-a', [
        started,
        state('seo', 'idle', 'running'),
        cost('seo', 0.5),
        output('seo'),
        state('seo', 'running', 'done'),
      ]),
      await run('2026-10-25-b', [
        started,
        state('security', 'idle', 'running'),
        cost('security', 0.05),
        output('security'),
        state('security', 'running', 'held', 'a reason'),
      ]),
      await run('2026-10-25-c', [
        started,
        state('voice', 'idle', 'running'),
        output('voice'),
        state('voice', 'running', 'done'),
      ]),
    ]);
    expect(rows.map((r) => [r.agent, r.ended, r.costed])).toEqual([
      ['voice', 'done', false],
      ['security', 'held', true],
      ['seo', 'done', true],
    ]);
    expect(spendIn(rows, '2026-10')).toEqual({ usd: 0.05, isFloor: true });
    expect(spendIn(rows, '2026-09')).toEqual({ usd: 0.5, isFloor: false });
  });
});
