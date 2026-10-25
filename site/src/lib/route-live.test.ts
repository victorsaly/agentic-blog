// Why: the route Victor reads must be the newest he can know: a live run that moved on since the deploy has to
// show as it is, and each step has to open the run it is about.
import { describe, expect, it } from 'vitest';
import type { WorkflowInput } from '@roadbook/core';
import { layoutOf } from '@roadbook/core/route';
import { liveRoute } from './route-live';

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
      { ask: 'done' },
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
});
