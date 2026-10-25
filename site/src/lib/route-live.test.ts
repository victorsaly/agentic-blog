// Why: the route Victor reads must be the newest he can know: a live run that moved on since the deploy has to
// show as it is, and each step has to open the run it is about.
import { describe, expect, it } from 'vitest';
import { Ledger, type WorkflowInput } from '@roadbook/core';
import { layoutOf } from '@roadbook/core/route';
import { builtStepsOf, liveRoute } from './route-live';
import type { LiveCell } from './pipeline';

const workflow = {
  id: 'w',
  why: 'Two steps and a gate.',
  nodes: {
    ask: { kind: 'agent', why: 'Asks.' },
    answers: { kind: 'gate', why: 'Owner.', after: ['ask'], asks: 'answer', question: 'Well?' },
    write: { kind: 'agent', why: 'Writes.', after: ['answers'] },
  },
} as unknown as WorkflowInput;

describe('liveRoute', () => {
  it('takes the live state over the deploy, only for this thought, and links each step to its run', () => {
    const { route, links } = liveRoute(
      layoutOf(workflow),
      { ask: { state: 'done', run: '20261025T190000Z-ask-0001' } },
      [
        {
          id: '20261025T200546Z-answers-ad75',
          thought: 't',
          agent: 'answers',
          state: 'needs-you',
          startedAt: '',
          runs: 1,
        },
        {
          id: '20261025T200000Z-write-0001',
          thought: 'other',
          agent: 'write',
          state: 'running',
          startedAt: '',
          runs: 1,
        },
      ],
      't',
    );
    expect(route.states).toEqual({ ask: 'done', answers: 'needs-you', write: 'not-run' });
    expect(links).toEqual({ answers: '/studio/agents/run?id=20261025T200546Z-answers-ad75' });
  });

  const cell = (id: string, state: string): LiveCell => ({
    id,
    thought: 't',
    agent: 'ask',
    state,
    startedAt: '',
    runs: 1,
  });
  const route = (built: Parameters<typeof liveRoute>[1], live: LiveCell[]) =>
    liveRoute(layoutOf(workflow), built, live, 't');

  it('never lets an older live run, or the live copy of a run the ledger has ended, undo the record', () => {
    const done = { ask: { state: 'done' as const, run: '20261025T190000Z-ask-0002' } };
    const older = route(done, [cell('20261025T180000Z-ask-0001', 'held')]);
    expect(older.route.states.ask).toBe('done');
    // The live copy only has an older run, so no step links to it; the newer run is not there to open.
    expect(older.links).toEqual({});
    const missed = route(done, [cell('20261025T190000Z-ask-0002', 'running')]);
    expect(missed.route.states.ask).toBe('done');
    expect(missed.links.ask).toBe('/studio/agents/run?id=20261025T190000Z-ask-0002');
  });

  it('takes the live copy for a newer run, or for the same run when the ledger has no ending yet', () => {
    const waiting = { ask: { state: 'running' as const, run: '20261025T190000Z-ask-0002' } };
    expect(route(waiting, [cell('20261025T190000Z-ask-0002', 'done')]).route.states.ask).toBe(
      'done',
    );
    const newer = route({ ask: { state: 'done', run: '20261025T190000Z-ask-0002' } }, [
      cell('20261025T200000Z-ask-0003', 'failed'),
    ]);
    expect(newer.route.states.ask).toBe('failed');
    expect(newer.links.ask).toBe('/studio/agents/run?id=20261025T200000Z-ask-0003');
  });
});

describe('builtStepsOf', () => {
  const step = async (id: string, node: string, to: 'done' | 'needs-you') => {
    const ledger = new Ledger();
    await ledger.append({ type: 'node.state', node, from: 'idle', to });
    return { id, events: ledger.events };
  };

  it("keeps each step's last state with the run that recorded it, gates included", async () => {
    expect(
      builtStepsOf([
        await step('r1', 'ask', 'done'),
        await step('r2', 'answers', 'needs-you'),
        await step('r3', 'ask', 'done'),
      ]),
    ).toEqual({
      ask: { state: 'done', run: 'r3' },
      answers: { state: 'needs-you', run: 'r2' },
    });
  });
});
