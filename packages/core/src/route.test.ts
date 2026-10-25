// Why: the route is how a person sees where their work stands; a step drawn in the wrong column hides what it
// waits for, and a state drawn wrong says work is done, or waiting on them, when it is not.
import { describe, expect, it } from 'vitest';
import { Ledger, type EventBody } from './ledger.js';
import { layoutOf, routeOf, statesOfRuns } from './route.js';
import type { WorkflowInput } from './schema.js';

// Cards are left out: the route reads only the shape of the workflow.
const workflow = {
  id: 'w',
  why: 'A small workflow with a join and a gate.',
  nodes: {
    origin: { kind: 'input', why: 'Where it starts.', accepts: ['text'] },
    transcribe: { kind: 'tool', why: 'Words.', after: ['origin'], does: 'Writes it down.' },
    ask: { kind: 'agent', why: 'Asks.', after: ['transcribe'] },
    answers: {
      kind: 'gate',
      why: 'Only the owner answers.',
      after: ['ask'],
      asks: 'answer',
      question: 'Well?',
    },
    write: { kind: 'agent', why: 'Writes.', after: ['answers'] },
    draw: { kind: 'agent', why: 'Draws.', after: ['answers'] },
    guard: { kind: 'guard', why: 'Holds.', after: ['write', 'draw'] },
    out: { kind: 'sink', why: 'Goes out.', after: ['guard'] },
  },
} as unknown as WorkflowInput;

async function run(...bodies: EventBody[]) {
  const ledger = new Ledger();
  for (const body of bodies) await ledger.append(body);
  return { events: ledger.events };
}

describe('layoutOf', () => {
  it('puts each step one column past the latest step it waits for, siblings in rows', () => {
    const layout = layoutOf(workflow);
    const at = Object.fromEntries(layout.steps.map((s) => [s.id, [s.column, s.row]]));
    expect(at).toEqual({
      origin: [0, 0],
      transcribe: [1, 0],
      ask: [2, 0],
      answers: [3, 0],
      write: [4, 0],
      draw: [4, 1],
      guard: [5, 0],
      out: [6, 0],
    });
    expect(layout.columns).toBe(7);
    expect(layout.rows).toBe(2);
    expect(layout.edges).toContainEqual({ from: 'draw', to: 'guard' });
  });
});

describe('routeOf', () => {
  it('fills each step from the ledger, and passes the steps the ledger does not record', async () => {
    const runs = [
      await run(
        { type: 'node.state', node: 'ask', from: 'idle', to: 'running' },
        { type: 'node.state', node: 'ask', from: 'running', to: 'done' },
      ),
      await run({ type: 'node.state', node: 'answers', from: 'idle', to: 'needs-you' }),
    ];
    const { states } = routeOf(layoutOf(workflow), statesOfRuns(runs));
    expect(states).toMatchObject({
      origin: 'done',
      transcribe: 'done',
      ask: 'done',
      answers: 'needs-you',
      write: 'not-run',
      guard: 'not-run',
      out: 'not-run',
    });
  });

  it('counts the way out as done only when everything before it is', () => {
    const done = new Map([
      ['ask', 'done' as const],
      ['answers', 'done' as const],
      ['write', 'done' as const],
      ['draw', 'done' as const],
      ['guard', 'done' as const],
    ]);
    expect(routeOf(layoutOf(workflow), done).states['out']).toBe('done');
    expect(
      routeOf(layoutOf(workflow), new Map([...done, ['guard', 'held' as const]])).states['out'],
    ).toBe('not-run');
  });
});
