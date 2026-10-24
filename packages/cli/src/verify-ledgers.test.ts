// Why: this check is what makes a ledger proof in CI; it must pass untouched runs, catch an edited past line
// and fail a ledger it cannot read, naming the thought each time.
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Ledger } from '@roadbook/core';
import { saveRun } from '@roadbook/core/node';
import { verifyLedgers } from './verify-ledgers.js';

async function repoWithRun(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'repo-'));
  await mkdir(join(root, 'thoughts', 'a'), { recursive: true });
  await mkdir(join(root, 'thoughts', 'no-ledger'), { recursive: true });
  const ledger = new Ledger();
  await ledger.append({ type: 'run.started', workflow: 'blog-post', origin: 'o', by: 'local' });
  await ledger.append({ type: 'node.state', node: 'safety', from: 'idle', to: 'running' });
  await saveRun(join(root, 'thoughts', 'a'), 'r1', ledger);
  return root;
}

describe('verifyLedgers', () => {
  it('passes untouched runs, and a thought with no ledger at all', async () => {
    expect(await verifyLedgers(await repoWithRun())).toEqual({ checked: 1, issues: [] });
  });

  it('fails when a past line was edited', async () => {
    const root = await repoWithRun();
    const file = join(root, 'thoughts', 'a', 'ledger', 'r1.jsonl');
    await writeFile(file, (await readFile(file, 'utf8')).replace('"to":"running"', '"to":"held"'));
    const { issues } = await verifyLedgers(root);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('thoughts/a/ledger/r1: the run does not verify from event 1');
  });

  it('fails a ledger it cannot read instead of passing it', async () => {
    const root = await repoWithRun();
    await writeFile(join(root, 'thoughts', 'no-ledger', 'ledger'), 'a file where the folder goes');
    const { issues } = await verifyLedgers(root);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain('thoughts/no-ledger: the ledger cannot be read');
  });
});
