// Why: this check is what makes a ledger proof in CI; it must pass an untouched ledger and catch an edited
// past line, a cut end and a missing half, naming the thought each time.
import { describe, expect, it } from 'vitest';
import { Ledger, eventLines } from '@roadbook/core';
import { verifyLedgerFiles } from './verify-ledgers.js';

async function run(): Promise<{ events: string; head: string }> {
  const ledger = new Ledger();
  await ledger.append({ type: 'run.started', workflow: 'blog-post', origin: 'o', by: 'local' });
  await ledger.append({ type: 'node.state', node: 'safety', from: 'idle', to: 'running' });
  await ledger.append({ type: 'node.state', node: 'safety', from: 'running', to: 'done' });
  return { events: eventLines(ledger.events), head: JSON.stringify(ledger.head) };
}

describe('verifyLedgerFiles', () => {
  it('passes an untouched ledger, and a thought with no ledger at all', async () => {
    const { events, head } = await run();
    expect(await verifyLedgerFiles('thoughts/a', events, head)).toEqual([]);
    expect(await verifyLedgerFiles('thoughts/a', null, null)).toEqual([]);
  });

  it('fails when a past line was edited', async () => {
    const { events, head } = await run();
    const edited = events.replace('"to":"running"', '"to":"held"');
    const issues = await verifyLedgerFiles('thoughts/a', edited, head);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('thoughts/a: the ledger does not verify from event 1');
  });

  it('fails when the last events were cut off, or one half is missing', async () => {
    const { events, head } = await run();
    const cut = events.split('\n').slice(0, 2).join('\n');
    expect(await verifyLedgerFiles('thoughts/a', cut, head)).toHaveLength(1);
    expect(await verifyLedgerFiles('thoughts/a', events, null)).toEqual([
      'thoughts/a: ledger.jsonl has no ledger.head. Fix: restore the head from git.',
    ]);
  });
});
