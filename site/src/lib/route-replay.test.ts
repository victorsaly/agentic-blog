// Why: the replay on /how-it-works is offered as what really happened, so it must follow the ledger exactly:
// every change in the order it happened, a person's call said as theirs, a failed step run again said so,
// and nothing after the post went live.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { LedgerEvent, WorkflowInput } from '@roadbook/core';
import { readRuns } from '@roadbook/core/node';
import project from '../../../roadbook.config';
import { replayOf } from './route-replay';

const workflow = {
  id: 'w',
  why: 'Ask, answer, write, publish.',
  nodes: {
    ask: { kind: 'agent', why: 'Asks.' },
    answers: { kind: 'gate', why: 'Owner.', after: ['ask'], asks: 'answer', question: 'Well?' },
    write: { kind: 'agent', why: 'Writes.', after: ['answers'] },
    live: { kind: 'sink', why: 'Out.', after: ['write'] },
  },
} as unknown as WorkflowInput;

let seq = 0;
const change = (at: string, node: string, from: string, to: string): LedgerEvent =>
  ({
    seq: seq++,
    type: 'node.state',
    at,
    node,
    from,
    to,
    hash: '',
    prev: '',
  }) as unknown as LedgerEvent;

describe('replayOf', () => {
  it('puts changes in the order they happened, joins a moment, and says who decided', () => {
    const runs = [
      // Out of order across runs on purpose: the write run's file sorts first.
      {
        events: [
          change('2026-10-25T10:20:00Z', 'write', 'idle', 'running'),
          change('2026-10-25T10:21:00Z', 'write', 'running', 'failed'),
          change('2026-10-25T10:30:00Z', 'write', 'failed', 'running'),
          change('2026-10-25T10:31:00Z', 'write', 'running', 'done'),
        ],
      },
      {
        events: [
          change('2026-10-25T10:00:00Z', 'ask', 'idle', 'running'),
          change('2026-10-25T10:00:30Z', 'ask', 'running', 'done'),
          change('2026-10-25T10:00:31Z', 'answers', 'idle', 'needs-you'),
          change('2026-10-25T10:19:58Z', 'answers', 'needs-you', 'done'),
        ],
      },
    ];
    const { frames, asked, again } = replayOf(workflow, runs, 'Victor');
    expect(frames.map((f) => f.said)).toEqual([
      'Ask starts.',
      'Ask is done. Waiting for Victor: Well?',
      'Victor answered. Write starts.',
      'Write did not finish.',
      'Write is run again.',
      'Write is done.',
    ]);
    expect(frames.map((f) => f.minute)).toEqual([0, 0, 19, 21, 30, 31]);
    expect(frames.at(-1)?.states).toMatchObject({
      ask: 'done',
      answers: 'done',
      write: 'done',
      live: 'done',
    });
    expect(frames[1]?.states.answers).toBe('needs-you');
    expect([asked, again]).toEqual([1, 1]);
    // A long wait holds longer than a quick step, and the last frame does not hold at all.
    expect(frames[1]?.hold ?? 0).toBeGreaterThan(frames[0]?.hold ?? 0);
    expect(frames.at(-1)?.hold).toBe(0);
  });

  it('stops where the post went live', () => {
    const runs = [
      {
        events: [
          change('2026-10-25T10:00:00Z', 'write', 'idle', 'done'),
          change('2026-10-25T11:00:00Z', 'write', 'done', 'running'),
        ],
      },
    ];
    const { frames } = replayOf(workflow, runs, 'Victor');
    expect(frames.map((f) => f.said)).toEqual(['Write is done.']);
  });

  it('replays the September post to the merge, with its three calls and two steps run again', async () => {
    const slug = '2026-10-25-september-last-year-tried';
    const { runs, issues } = await readRuns(join(__dirname, '../../../thoughts', slug));
    expect(issues).toEqual([]);
    const blog = project.workflows.find((w) => w.id === 'blog-post');
    if (!blog) throw new Error('no blog-post workflow');
    const replay = replayOf(blog, runs, 'Victor');
    expect(replay.asked).toBe(3);
    expect(replay.again).toBe(3);
    expect(replay.frames.at(-1)?.said).toBe('Victor approved.');
    expect(replay.frames.at(-1)?.states.main).toBe('done');
  });
});
