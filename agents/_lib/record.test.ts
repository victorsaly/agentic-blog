// Why: these rules decide what the ledger says about every run; a wrong end state or a missing why would be
// recorded for good, since the ledger is never edited.
import { describe, expect, it } from 'vitest';
import { Ledger } from '@roadbook/core';
import { assertNotLedger, endState, lastState, originOf, startedBy, whyOf } from './record.js';

describe('endState', () => {
  it('maps each result to a state, with the reason when there is one', () => {
    expect(endState({ status: 'done', summary: '', files: [] })).toEqual({ to: 'done' });
    expect(endState({ status: 'nothing-to-do', summary: '', files: [] })).toEqual({
      to: 'done',
      reason: 'nothing to do',
    });
    expect(
      endState({ status: 'held', summary: '', files: [], holdReason: 'names a child' }),
    ).toEqual({ to: 'held', reason: 'names a child' });
    expect(endState({ status: 'not-implemented', summary: '', files: [] }).to).toBe('idle');
  });
});

describe('lastState', () => {
  it('starts from where the agent last ended in this thought, or idle', async () => {
    const ledger = new Ledger();
    expect(lastState(ledger.events, 'safety')).toBe('idle');
    await ledger.append({ type: 'node.state', node: 'safety', from: 'idle', to: 'running' });
    await ledger.append({ type: 'node.state', node: 'safety', from: 'running', to: 'held' });
    await ledger.append({ type: 'node.state', node: 'seo', from: 'idle', to: 'running' });
    expect(lastState(ledger.events, 'safety')).toBe('held');
  });
});

describe('whyOf', () => {
  const summary = 'Read every version for harm and found none.';
  const agentWhy = 'Nothing goes out that hurts someone, and a human hears why when it holds.';

  it("uses the file's own why, then the run summary, then the agent's why", () => {
    const md =
      '---\nwhy: >\n  The safety verdict on this post,\n  read before merging.\n---\nPass.';
    expect(whyOf({ path: 'safety.md', content: md }, summary, agentWhy)).toBe(
      'The safety verdict on this post, read before merging.',
    );
    expect(
      whyOf({ path: 'image/cover.png', content: '', bytes: new Uint8Array() }, summary, agentWhy),
    ).toBe(summary);
    expect(
      whyOf({ path: 'image/cover.png', content: '', bytes: new Uint8Array() }, 'ok', agentWhy),
    ).toBe(agentWhy);
  });
});

describe('originOf and startedBy', () => {
  it('names the first origin file, never the answers file', () => {
    expect(originOf('2026-10-23-a', ['structure.md', 'origin/text.md', 'origin/answers.md'])).toBe(
      'thoughts/2026-10-23-a/origin/text.md',
    );
    expect(originOf('2026-10-23-a', ['structure.md'])).toBe('thoughts/2026-10-23-a/origin/');
  });

  it('names the GitHub account in a workflow and nobody in particular on a machine', () => {
    expect(startedBy({ GITHUB_ACTOR: 'victorsaly' })).toBe('github:victorsaly');
    expect(startedBy({})).toBe('local');
  });
});

describe('assertNotLedger', () => {
  it('refuses an agent that writes or removes the ledger', () => {
    expect(() => {
      assertNotLedger([{ path: 'ledger.jsonl', content: '' }]);
    }).toThrow('only the runner writes the ledger');
    expect(() => {
      assertNotLedger([{ path: 'ledger.head', content: '', remove: true }]);
    }).toThrow('only the runner writes the ledger');
    expect(() => {
      assertNotLedger([{ path: 'safety.md', content: '' }]);
    }).not.toThrow();
  });
});
